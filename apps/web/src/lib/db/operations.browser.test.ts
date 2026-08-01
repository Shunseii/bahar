import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./test/create-test-db";

const dbRef = vi.hoisted(() => ({ current: undefined as TestDb | undefined }));

vi.mock(".", async (importOriginal) => ({
  ...(await importOriginal()),
  ensureDb: vi.fn(async () => dbRef.current?.db),
  getDb: vi.fn(() => dbRef.current?.db),
  getDrizzleDb: vi.fn(() => dbRef.current?.drizzleDb),
}));

const { dictionaryEntriesTable, flashcardsTable } = await import(
  "./operations"
);

// Batching is what makes an entry + its flashcards atomic, and it runs through
// a batch callback each adapter implements over its own engine. The operation
// itself is tested in @bahar/db-operations against the Node engine; this covers
// web's adapter driving the real sync-wasm engine, whose transaction API
// differs.
describe("dictionaryEntriesTable.addWordWithFlashcards (web wiring)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbRef.current = testDb;
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("writes the entry and its flashcard in one batch", async () => {
    const { entry, forward } =
      await dictionaryEntriesTable.addWordWithFlashcards.mutation({
        word: { word: "نور", translation: "light", type: "ism" },
      });

    const cards = await flashcardsTable.findByEntryId.query(entry.id);

    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe(forward.id);
  });

  it("rolls the entry back when the flashcard insert fails", async () => {
    await testDb.db.exec(`
      CREATE TRIGGER reject_flashcards BEFORE INSERT ON flashcards
      BEGIN SELECT RAISE(ABORT, 'flashcard insert rejected'); END;
    `);

    await expect(
      dictionaryEntriesTable.addWordWithFlashcards.mutation({
        word: { word: "نور", translation: "light", type: "ism" },
      })
    ).rejects.toThrow();

    // list.query resolves to the array of entries -- asserting on `.entries`
    // here read as a property but is Array.prototype.entries, whose arity is 0,
    // so the assertion passed no matter what the rollback did.
    const remaining = await dictionaryEntriesTable.list.query({});

    expect(remaining).toHaveLength(0);
  });
});

// The bulk operations fan a selection out over several statements per call. The
// logic is covered against the Node engine in @bahar/db-operations; this pins
// down that web's sync-wasm adapter runs them, since `inArray` binds a variable
// number of parameters per statement.
describe("dictionary bulk operations (web wiring)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbRef.current = testDb;
  });

  afterEach(async () => {
    await testDb.close();
  });

  const addWord = async (word: string) => {
    const { entry } =
      await dictionaryEntriesTable.addWordWithFlashcards.mutation({
        word: { word, translation: word, type: "ism" },
      });

    return entry;
  };

  it("deletes several entries and their flashcards", async () => {
    const first = await addWord("نور");
    const second = await addWord("قلم");
    const kept = await addWord("كتاب");

    const deleted = await dictionaryEntriesTable.bulkDelete.mutation({
      ids: [first.id, second.id],
    });

    expect(deleted).toHaveLength(2);
    expect(await flashcardsTable.findByEntryId.query(first.id)).toHaveLength(0);
    expect(await flashcardsTable.findByEntryId.query(kept.id)).toHaveLength(1);

    const remaining = await dictionaryEntriesTable.list.query({});
    expect(remaining.map((entry) => entry.id)).toEqual([kept.id]);
  });

  it("adds and removes tags across a selection", async () => {
    const first = await addWord("نور");
    const second = await addWord("قلم");
    const ids = [first.id, second.id];

    await dictionaryEntriesTable.bulkUpdateTags.mutation({
      ids,
      tags: ["daily"],
      action: "add",
    });

    expect(await dictionaryEntriesTable.tagsForEntries.query({ ids })).toEqual([
      { tag: "daily", count: 2 },
    ]);

    await dictionaryEntriesTable.bulkUpdateTags.mutation({
      ids,
      tags: ["daily"],
      action: "remove",
    });

    expect(await dictionaryEntriesTable.tagsForEntries.query({ ids })).toEqual(
      []
    );
  });

  it("creates and deletes reverse flashcards across a selection", async () => {
    const first = await addWord("نور");
    const second = await addWord("قلم");
    const ids = [first.id, second.id];

    expect(
      await flashcardsTable.bulkSetReverse.mutation({
        dictionary_entry_ids: ids,
        enabled: true,
      })
    ).toEqual({ changed: 2, unchanged: 0 });
    expect(
      await flashcardsTable.reverseCountForEntries.query({
        dictionary_entry_ids: ids,
      })
    ).toBe(2);

    expect(
      await flashcardsTable.bulkSetReverse.mutation({
        dictionary_entry_ids: ids,
        enabled: false,
      })
    ).toEqual({ changed: 2, unchanged: 0 });
    expect(
      await flashcardsTable.countForEntries.query({
        dictionary_entry_ids: ids,
      })
    ).toBe(2);
  });
});
