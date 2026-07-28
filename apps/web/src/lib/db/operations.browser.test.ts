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

    const remaining = await dictionaryEntriesTable.list.query({});

    expect(remaining.entries).toHaveLength(0);
  });
});
