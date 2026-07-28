import { FlashcardState } from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./test/create-test-db";
import { insertDictionaryEntry, insertFlashcard } from "./test/factories";

// The clearBacklog reschedule/transaction logic is tested against a real DB in
// @bahar/db-operations. This suite only covers web's wiring: that its
// postRevlogBatch wrapper actually forwards the rescheduled cards' revlogs to
// the API client (which the package intentionally knows nothing about).

const dbRef = vi.hoisted(() => ({ current: undefined as TestDb | undefined }));

vi.mock(".", async (importOriginal) => ({
  ...(await importOriginal()),
  ensureDb: vi.fn(async () => dbRef.current?.db),
  getDb: vi.fn(() => dbRef.current?.db),
  getDrizzleDb: vi.fn(() => dbRef.current?.drizzleDb),
}));

const revlogPost = vi.hoisted(() =>
  vi.fn<
    (arg: {
      entries: { source: string; dictionary_entry_id: string }[];
    }) => Promise<{ data: null; error: null }>
  >(() => Promise.resolve({ data: null, error: null }))
);
vi.mock("../api", () => ({
  api: { stats: { revlogs: { batch: { post: revlogPost } } } },
}));

const { dictionaryEntriesTable, flashcardsTable } = await import(
  "./operations"
);

describe("flashcardsTable.clearBacklog (web wiring)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbRef.current = testDb;
    revlogPost.mockClear();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("posts the rescheduled cards' revlogs to the API", async () => {
    const entry = await insertDictionaryEntry(testDb);
    const oldDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
    await insertFlashcard(testDb, {
      dictionary_entry_id: entry.id,
      due: oldDueDate.toISOString(),
      due_timestamp_ms: oldDueDate.getTime(),
      state: FlashcardState.NEW,
    });

    // Drain the generator (reschedules the one backlog card).
    for await (const _ of flashcardsTable.clearBacklog.generator({})) {
      // progress steps are asserted in the package tests
    }

    // Wait a tick for the fire-and-forget post.
    await Promise.resolve();

    expect(revlogPost).toHaveBeenCalledTimes(1);
    const { entries } = revlogPost.mock.calls[0][0];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      source: "clear_backlog",
      dictionary_entry_id: entry.id,
    });
  });

  it("does not post when there is no backlog", async () => {
    await insertFlashcard(testDb);

    for await (const _ of flashcardsTable.clearBacklog.generator({})) {
      // no-op
    }
    await Promise.resolve();

    expect(revlogPost).not.toHaveBeenCalled();
  });
});

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
