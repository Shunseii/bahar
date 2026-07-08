import {
  FlashcardState,
  type SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import { insertDictionaryEntry, insertFlashcard } from "../test/factories";
import {
  type ClearBacklogRevlogEntry,
  makeFlashcardsTable,
} from "./flashcards";

const consumeGenerator = async (
  generator: AsyncGenerator<{ cleared: number; total: number }>
) => {
  const progress: { cleared: number; total: number }[] = [];
  for await (const step of generator) {
    progress.push(step);
  }
  return progress;
};

describe("flashcardsTable", () => {
  let testDb: TestDb;
  let flashcardsTable: ReturnType<typeof makeFlashcardsTable>;

  beforeEach(async () => {
    testDb = await createTestDb();
    flashcardsTable = makeFlashcardsTable({
      getDb: async () => testDb.drizzleDb,
    });
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("create", () => {
    it("inserts a new flashcard and returns it", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const due = new Date().toISOString();

      const newFlashcard = await flashcardsTable.create.mutation({
        flashcard: { dictionary_entry_id: entry.id, due, direction: "forward" },
      });

      expect(newFlashcard).toMatchObject({
        id: expect.any(String),
        dictionary_entry_id: entry.id,
        due,
        direction: "forward",
        is_hidden: false,
      });
    });
  });

  describe("update", () => {
    it("updates only the provided fields, leaving others untouched", async () => {
      const flashcard = await insertFlashcard(testDb, {
        stability: 1,
        difficulty: 2,
      });

      const updated = await flashcardsTable.update.mutation({
        id: flashcard.id,
        updates: { stability: 5 },
      });

      expect(updated).toMatchObject({
        id: flashcard.id,
        stability: 5,
        difficulty: 2,
      });
    });

    it("updates every other field", async () => {
      const flashcard = await insertFlashcard(testDb);
      const lastReviewDate = new Date();

      const updates = {
        due: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        due_timestamp_ms: Date.now() + 1000 * 60 * 60 * 24,
        elapsed_days: 3,
        lapses: 1,
        learning_steps: 2,
        last_review: lastReviewDate.toISOString(),
        last_review_timestamp_ms: lastReviewDate.getTime(),
        reps: 4,
        scheduled_days: 5,
        state: FlashcardState.REVIEW,
        is_hidden: true,
      } satisfies Partial<Omit<SelectFlashcard, "id" | "dictionary_entry_id">>;

      const updated = await flashcardsTable.update.mutation({
        id: flashcard.id,
        updates,
      });

      expect(updated).toMatchObject(updates);
    });

    it("throws when no fields are provided", async () => {
      const flashcard = await insertFlashcard(testDb);

      await expect(
        flashcardsTable.update.mutation({ id: flashcard.id, updates: {} })
      ).rejects.toThrow("No fields to update");
    });

    it("throws when the flashcard does not exist", async () => {
      await expect(
        flashcardsTable.update.mutation({
          id: "not-a-real-id",
          updates: { stability: 5 },
        })
      ).rejects.toThrow("Flashcard not found");
    });
  });

  describe("reset", () => {
    it("resets a flashcard's progress back to the NEW state", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
        state: FlashcardState.REVIEW,
        stability: 10,
        reps: 5,
      });

      const reset = await flashcardsTable.reset.mutation({
        dictionary_entry_id: entry.id,
        direction: "forward",
      });

      expect(reset).toMatchObject({
        id: flashcard.id,
        state: FlashcardState.NEW,
        stability: 0,
        difficulty: 0,
        reps: 0,
        lapses: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        last_review: null,
      });
    });

    it("throws when no matching flashcard exists for that entry and direction", async () => {
      const entry = await insertDictionaryEntry(testDb);

      await expect(
        flashcardsTable.reset.mutation({
          dictionary_entry_id: entry.id,
          direction: "forward",
        })
      ).rejects.toThrow("Flashcard not found");
    });
  });

  describe("findByEntryId", () => {
    it("returns all flashcards for a dictionary entry", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
      });
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "reverse",
      });

      const results = await flashcardsTable.findByEntryId.query(entry.id);
      expect(results).toHaveLength(2);
    });

    it("returns an empty array when there are none", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const results = await flashcardsTable.findByEntryId.query(entry.id);
      expect(results).toEqual([]);
    });
  });

  describe("findByEntryAndDirection", () => {
    it("returns the flashcard when it exists", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
      });

      const result = await flashcardsTable.findByEntryAndDirection.query({
        dictionaryEntryId: entry.id,
        direction: "forward",
      });

      expect(result.data).toMatchObject({ id: flashcard.id });
    });

    it("returns { data: null } when it doesn't exist", async () => {
      const entry = await insertDictionaryEntry(testDb);

      const result = await flashcardsTable.findByEntryAndDirection.query({
        dictionaryEntryId: entry.id,
        direction: "reverse",
      });

      expect(result).toEqual({ data: null });
    });
  });

  describe("today", () => {
    it("filters by type", async () => {
      const ismEntry = await insertDictionaryEntry(testDb, { type: "ism" });
      const ismFlashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: ismEntry.id,
      });
      const filEntry = await insertDictionaryEntry(testDb, { type: "fi'l" });
      await insertFlashcard(testDb, { dictionary_entry_id: filEntry.id });

      const results = await flashcardsTable.today.query({
        filters: { types: ["ism"] },
      });

      expect(results.map((r) => r.id)).toEqual([ismFlashcard.id]);
    });

    it("filters by state", async () => {
      const newFlashcard = await insertFlashcard(testDb, {
        state: FlashcardState.NEW,
      });
      await insertFlashcard(testDb, { state: FlashcardState.REVIEW });

      const results = await flashcardsTable.today.query({
        filters: { state: [FlashcardState.NEW] },
      });

      expect(results.map((r) => r.id)).toEqual([newFlashcard.id]);
    });

    it("filters by tag", async () => {
      const fooEntry = await insertDictionaryEntry(testDb, { tags: ["foo"] });
      const fooFlashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: fooEntry.id,
      });
      const barEntry = await insertDictionaryEntry(testDb, { tags: ["bar"] });
      await insertFlashcard(testDb, { dictionary_entry_id: barEntry.id });

      const results = await flashcardsTable.today.query({
        filters: { tags: ["foo"] },
      });

      expect(results.map((r) => r.id)).toEqual([fooFlashcard.id]);
    });

    it("excludes reverse cards when showReverse is false", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const forward = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
      });
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "reverse",
      });

      const results = await flashcardsTable.today.query({ showReverse: false });
      expect(results.map((r) => r.id)).toEqual([forward.id]);
    });

    it("restricts to the regular queue when queue is 'regular'", async () => {
      const recentlyDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
      const regular = await insertFlashcard(testDb, {
        due: recentlyDue.toISOString(),
        due_timestamp_ms: recentlyDue.getTime(),
      });
      const oldDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      await insertFlashcard(testDb, {
        due: oldDue.toISOString(),
        due_timestamp_ms: oldDue.getTime(),
      });

      const results = await flashcardsTable.today.query({ queue: "regular" });
      expect(results.map((r) => r.id)).toEqual([regular.id]);
    });

    it("restricts to the backlog queue when queue is 'backlog'", async () => {
      const recentlyDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
      await insertFlashcard(testDb, {
        due: recentlyDue.toISOString(),
        due_timestamp_ms: recentlyDue.getTime(),
      });
      const oldDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      const backlog = await insertFlashcard(testDb, {
        due: oldDue.toISOString(),
        due_timestamp_ms: oldDue.getTime(),
      });

      const results = await flashcardsTable.today.query({ queue: "backlog" });
      expect(results.map((r) => r.id)).toEqual([backlog.id]);
    });

    it("excludes hidden flashcards", async () => {
      const entry = await insertDictionaryEntry(testDb, {
        type: "ism",
        tags: ["foo"],
      });
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        state: FlashcardState.NEW,
        is_hidden: true,
      });

      const results = await flashcardsTable.today.query({});
      expect(results).toEqual([]);
    });

    it("includes the full dictionary entry, with the entry's id (not the flashcard's) on the flat field", async () => {
      // Regression: flashcards.id and dictionary_entry.id are both literally
      // "id" in the SQL -- pins the alias down (see .as() in flashcards.ts).
      const entry = await insertDictionaryEntry(testDb, {
        word: "كتاب",
        translation: "book",
        tags: ["foo"],
      });
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
      });

      const results = await flashcardsTable.today.query({});
      const result = results.find((r) => r.id === flashcard.id);

      expect(result?.dictionary_entry).toMatchObject({
        id: entry.id,
        word: "كتاب",
        translation: "book",
        tags: ["foo"],
      });
      expect(result?.dictionary_entry_id).toBe(entry.id);
      expect(result?.id).toBe(flashcard.id);
    });
  });

  describe("counts", () => {
    it("returns separate regular and backlog counts split by due date", async () => {
      const recentlyDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
      await insertFlashcard(testDb, {
        due: recentlyDue.toISOString(),
        due_timestamp_ms: recentlyDue.getTime(),
      });
      const oldDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      await insertFlashcard(testDb, {
        due: oldDue.toISOString(),
        due_timestamp_ms: oldDue.getTime(),
      });

      const result = await flashcardsTable.counts.query({});
      expect(result).toEqual({ regular: 1, backlog: 1, total: 2 });
    });

    it("excludes not-yet-due flashcards from regular, backlog, and total", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2);
      await insertFlashcard(testDb, {
        due: futureDate.toISOString(),
        due_timestamp_ms: futureDate.getTime(),
      });

      const result = await flashcardsTable.counts.query({});
      expect(result).toEqual({ regular: 0, backlog: 0, total: 0 });
    });

    it("applies the same type/state/tags/showReverse filters as today.query", async () => {
      const matchEntry = await insertDictionaryEntry(testDb, {
        type: "ism",
        tags: ["foo"],
      });
      await insertFlashcard(testDb, {
        dictionary_entry_id: matchEntry.id,
        state: FlashcardState.NEW,
        direction: "forward",
      });
      const wrongTypeEntry = await insertDictionaryEntry(testDb, {
        type: "fi'l",
        tags: ["foo"],
      });
      await insertFlashcard(testDb, {
        dictionary_entry_id: wrongTypeEntry.id,
        state: FlashcardState.NEW,
        direction: "forward",
      });

      const result = await flashcardsTable.counts.query({
        filters: {
          types: ["ism"],
          state: [FlashcardState.NEW],
          tags: ["foo"],
        },
        showReverse: false,
      });

      expect(result.total).toBe(1);
    });

    it("excludes hidden flashcards from both counts", async () => {
      await insertFlashcard(testDb, { is_hidden: true });

      const result = await flashcardsTable.counts.query({});
      expect(result).toEqual({ regular: 0, backlog: 0, total: 0 });
    });
  });

  describe("clearBacklog", () => {
    it("reschedules all backlog flashcards by grading them as Hard, and hands the revlogs to postRevlogBatch", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const oldDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        due: oldDueDate.toISOString(),
        due_timestamp_ms: oldDueDate.getTime(),
        state: FlashcardState.NEW,
      });

      const postRevlogBatch = vi.fn<(e: ClearBacklogRevlogEntry[]) => void>();
      const table = makeFlashcardsTable(
        { getDb: async () => testDb.drizzleDb },
        { postRevlogBatch }
      );

      const progress = await consumeGenerator(table.clearBacklog.generator({}));

      expect(progress).toEqual([{ cleared: 1, total: 1 }]);

      const row = (await (
        await testDb.db.prepare("SELECT * FROM flashcards WHERE id = ?")
      ).get([flashcard.id])) as {
        due_timestamp_ms: number;
        last_review: string | null;
      };

      expect(row.due_timestamp_ms).toBeGreaterThan(oldDueDate.getTime());
      expect(row.last_review).not.toBeNull();

      // The rescheduled card's revlog is handed off exactly once, tagged for
      // the clear-backlog source, for the host app to POST.
      expect(postRevlogBatch).toHaveBeenCalledTimes(1);
      const entries = postRevlogBatch.mock.calls[0][0];
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        dictionary_entry_id: entry.id,
        rating: "hard",
        source: "clear_backlog",
      });
    });

    it("does not touch flashcards outside the backlog window", async () => {
      const recentlyDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
      const flashcard = await insertFlashcard(testDb, {
        due: recentlyDueDate.toISOString(),
        due_timestamp_ms: recentlyDueDate.getTime(),
      });

      await consumeGenerator(flashcardsTable.clearBacklog.generator({}));

      const row = (await (
        await testDb.db.prepare("SELECT * FROM flashcards WHERE id = ?")
      ).get([flashcard.id])) as { due_timestamp_ms: number };

      expect(row.due_timestamp_ms).toBe(recentlyDueDate.getTime());
    });

    it("yields nothing, makes no changes, and does not post when there's no backlog", async () => {
      await insertFlashcard(testDb);
      const postRevlogBatch = vi.fn<(e: ClearBacklogRevlogEntry[]) => void>();
      const table = makeFlashcardsTable(
        { getDb: async () => testDb.drizzleDb },
        { postRevlogBatch }
      );

      const progress = await consumeGenerator(table.clearBacklog.generator({}));

      expect(progress).toEqual([]);
      expect(postRevlogBatch).not.toHaveBeenCalled();
    });
  });

  describe("createFlashcardPair", () => {
    it("creates fresh forward + reverse cards for an entry", async () => {
      const entry = await insertDictionaryEntry(testDb);

      const { forward, reverse } =
        await flashcardsTable.createFlashcardPair.mutation({
          dictionary_entry_id: entry.id,
        });

      expect(forward).toMatchObject({
        dictionary_entry_id: entry.id,
        direction: "forward",
        state: FlashcardState.NEW,
        is_hidden: false,
      });
      expect(reverse).toMatchObject({
        dictionary_entry_id: entry.id,
        direction: "reverse",
        state: FlashcardState.NEW,
      });

      const all = await flashcardsTable.findByEntryId.query(entry.id);
      expect(all).toHaveLength(2);
    });
  });
});
