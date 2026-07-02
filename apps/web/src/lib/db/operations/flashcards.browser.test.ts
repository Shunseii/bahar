import {
  FlashcardState,
  type SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import { insertDictionaryEntry, insertFlashcard } from "../test/factories";

const dbRef = vi.hoisted(() => ({ current: undefined as TestDb | undefined }));

vi.mock("..", async (importOriginal) => ({
  ...(await importOriginal()),
  ensureDb: vi.fn(async () => dbRef.current?.db),
  getDb: vi.fn(() => dbRef.current?.db),
  getDrizzleDb: vi.fn(() => dbRef.current?.drizzleDb),
}));

// clearBacklog fire-and-forgets a revlog batch post to the real API client;
// mock it so tests don't attempt a real network call against an unconfigured
// VITE_API_BASE_URL.
vi.mock("../../api", () => ({
  api: {
    stats: {
      revlogs: {
        batch: {
          post: vi.fn(() => Promise.resolve({ data: null, error: null })),
        },
      },
    },
  },
}));

const { flashcardsTable } = await import("./flashcards");

describe("flashcardsTable", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbRef.current = testDb;
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("create", () => {
    it("inserts a new flashcard and returns it", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const due = new Date().toISOString();

      const newFlashcard = await flashcardsTable.create.mutation({
        flashcard: {
          dictionary_entry_id: entry.id,
          due,
          direction: "forward",
        },
      });

      expect(newFlashcard).toMatchObject({
        id: expect.any(String),
        dictionary_entry_id: entry.id,
        due,
        direction: "forward",
        is_hidden: false,
      });

      const flashcardExists = await testDb.db
        .prepare("SELECT * FROM flashcards WHERE id = ?")
        .get([newFlashcard.id]);

      expect(flashcardExists).toBeDefined();
    });
  });

  describe("update", () => {
    it("updates only the provided fields, leaving others untouched", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        stability: 1,
        difficulty: 2,
      });

      const updatedFlashcard = await flashcardsTable.update.mutation({
        id: flashcard.id,
        updates: { stability: 5 },
      });

      expect(updatedFlashcard).toMatchObject({
        id: flashcard.id,
        stability: 5,
        difficulty: 2,
      });

      const flashcardExists = await testDb.db
        .prepare("SELECT * FROM flashcards WHERE id = ?")
        .get([flashcard.id]);

      expect(flashcardExists.stability).toBe(5);
      expect(flashcardExists.difficulty).toBe(2);
    });

    it("updates every other field", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
      });

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

      const updatedFlashcard = await flashcardsTable.update.mutation({
        id: flashcard.id,
        updates,
      });

      expect(updatedFlashcard).toMatchObject({
        due: updates.due,
        due_timestamp_ms: updates.due_timestamp_ms,
        elapsed_days: updates.elapsed_days,
        lapses: updates.lapses,
        learning_steps: updates.learning_steps,
        last_review: updates.last_review,
        last_review_timestamp_ms: updates.last_review_timestamp_ms,
        reps: updates.reps,
        scheduled_days: updates.scheduled_days,
        state: updates.state,
        is_hidden: true,
      });

      const row = await testDb.db
        .prepare("SELECT * FROM flashcards WHERE id = ?")
        .get([flashcard.id]);

      expect(row).toMatchObject({
        due: updates.due,
        due_timestamp_ms: updates.due_timestamp_ms,
        elapsed_days: updates.elapsed_days,
        lapses: updates.lapses,
        learning_steps: updates.learning_steps,
        last_review: updates.last_review,
        last_review_timestamp_ms: updates.last_review_timestamp_ms,
        reps: updates.reps,
        scheduled_days: updates.scheduled_days,
        state: updates.state,
        is_hidden: 1,
      });
    });

    it("throws when no fields are provided", async () => {
      const flashcard = await insertFlashcard(testDb);

      const updateResult = flashcardsTable.update.mutation({
        id: flashcard.id,
        updates: {},
      });

      await expect(updateResult).rejects.toThrow("No fields to update");
    });

    it("throws when the flashcard does not exist", async () => {
      const updateResult = flashcardsTable.update.mutation({
        id: "not-a-real-id",
        updates: { stability: 5 },
      });

      await expect(updateResult).rejects.toThrow("Flashcard not found");
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

      const resetFlashcard = await flashcardsTable.reset.mutation({
        dictionary_entry_id: entry.id,
        direction: "forward",
      });

      expect(resetFlashcard).toMatchObject({
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

      const resetResult = flashcardsTable.reset.mutation({
        dictionary_entry_id: entry.id,
        direction: "forward",
      });

      await expect(resetResult).rejects.toThrow("Flashcard not found");
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
    describe("types filter", () => {
      it("returns only flashcards whose dictionary entry matches a specified type", async () => {
        const ismEntry = await insertDictionaryEntry(testDb, { type: "ism" });
        const ismFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: ismEntry.id,
        });

        const filEntry = await insertDictionaryEntry(testDb, {
          type: "fi'l",
        });
        await insertFlashcard(testDb, { dictionary_entry_id: filEntry.id });

        const results = await flashcardsTable.today.query({
          filters: { types: ["ism"] },
        });

        expect(results.map((r) => r.id)).toEqual([ismFlashcard.id]);
      });

      it("defaults to returning all word types when types is unset", async () => {
        const ids: string[] = [];

        for (const type of ["ism", "fi'l", "harf", "expression"] as const) {
          const entry = await insertDictionaryEntry(testDb, { type });
          const flashcard = await insertFlashcard(testDb, {
            dictionary_entry_id: entry.id,
          });
          ids.push(flashcard.id);
        }

        const results = await flashcardsTable.today.query({});

        expect(results.map((r) => r.id).sort()).toEqual(ids.sort());
      });
    });

    describe("state filter", () => {
      it("returns only flashcards in a specified FSRS state", async () => {
        const newEntry = await insertDictionaryEntry(testDb);
        const newFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: newEntry.id,
          state: FlashcardState.NEW,
        });

        const reviewEntry = await insertDictionaryEntry(testDb);
        await insertFlashcard(testDb, {
          dictionary_entry_id: reviewEntry.id,
          state: FlashcardState.REVIEW,
        });

        const results = await flashcardsTable.today.query({
          filters: { state: [FlashcardState.NEW] },
        });

        expect(results.map((r) => r.id)).toEqual([newFlashcard.id]);
      });

      it("defaults to returning all states when state is unset", async () => {
        const ids: string[] = [];

        for (const state of [
          FlashcardState.NEW,
          FlashcardState.LEARNING,
          FlashcardState.REVIEW,
          FlashcardState.RE_LEARNING,
        ]) {
          const entry = await insertDictionaryEntry(testDb);
          const flashcard = await insertFlashcard(testDb, {
            dictionary_entry_id: entry.id,
            state,
          });
          ids.push(flashcard.id);
        }

        const results = await flashcardsTable.today.query({});

        expect(results.map((r) => r.id).sort()).toEqual(ids.sort());
      });
    });

    describe("tags filter", () => {
      it("returns only flashcards whose dictionary entry has a specified tag", async () => {
        const fooEntry = await insertDictionaryEntry(testDb, {
          tags: ["foo"],
        });
        const fooFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: fooEntry.id,
        });

        const barEntry = await insertDictionaryEntry(testDb, {
          tags: ["bar"],
        });
        await insertFlashcard(testDb, { dictionary_entry_id: barEntry.id });

        const results = await flashcardsTable.today.query({
          filters: { tags: ["foo"] },
        });

        expect(results.map((r) => r.id)).toEqual([fooFlashcard.id]);
      });

      it("does not restrict by tag when tags is unset", async () => {
        const fooEntry = await insertDictionaryEntry(testDb, {
          tags: ["foo"],
        });
        const fooFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: fooEntry.id,
        });

        const noTagEntry = await insertDictionaryEntry(testDb, {
          tags: null,
        });
        const noTagFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: noTagEntry.id,
        });

        const results = await flashcardsTable.today.query({});

        expect(results.map((r) => r.id).sort()).toEqual(
          [fooFlashcard.id, noTagFlashcard.id].sort()
        );
      });
    });

    describe("showReverse", () => {
      it("excludes reverse-direction flashcards when showReverse is false", async () => {
        const entry = await insertDictionaryEntry(testDb);
        const forwardFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: entry.id,
          direction: "forward",
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: entry.id,
          direction: "reverse",
        });

        const results = await flashcardsTable.today.query({
          showReverse: false,
        });

        expect(results.map((r) => r.id)).toEqual([forwardFlashcard.id]);
      });

      it("includes reverse-direction flashcards when showReverse is true", async () => {
        const entry = await insertDictionaryEntry(testDb);
        const forwardFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: entry.id,
          direction: "forward",
        });
        const reverseFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: entry.id,
          direction: "reverse",
        });

        const results = await flashcardsTable.today.query({
          showReverse: true,
        });

        expect(results.map((r) => r.id).sort()).toEqual(
          [forwardFlashcard.id, reverseFlashcard.id].sort()
        );
      });
    });

    describe("queue", () => {
      it("restricts to the regular queue when queue is 'regular'", async () => {
        const regularEntry = await insertDictionaryEntry(testDb);
        const recentlyDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
        const regularFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: regularEntry.id,
          due: recentlyDueDate.toISOString(),
          due_timestamp_ms: recentlyDueDate.getTime(),
        });

        const backlogEntry = await insertDictionaryEntry(testDb);
        const oldDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
        await insertFlashcard(testDb, {
          dictionary_entry_id: backlogEntry.id,
          due: oldDueDate.toISOString(),
          due_timestamp_ms: oldDueDate.getTime(),
        });

        const results = await flashcardsTable.today.query({
          queue: "regular",
        });

        expect(results.map((r) => r.id)).toEqual([regularFlashcard.id]);
      });

      it("restricts to the backlog queue when queue is 'backlog'", async () => {
        const regularEntry = await insertDictionaryEntry(testDb);
        const recentlyDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
        await insertFlashcard(testDb, {
          dictionary_entry_id: regularEntry.id,
          due: recentlyDueDate.toISOString(),
          due_timestamp_ms: recentlyDueDate.getTime(),
        });

        const backlogEntry = await insertDictionaryEntry(testDb);
        const oldDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
        const backlogFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: backlogEntry.id,
          due: oldDueDate.toISOString(),
          due_timestamp_ms: oldDueDate.getTime(),
        });

        const results = await flashcardsTable.today.query({
          queue: "backlog",
        });

        expect(results.map((r) => r.id)).toEqual([backlogFlashcard.id]);
      });

      it("returns both queues when queue is 'all' (the default)", async () => {
        const regularEntry = await insertDictionaryEntry(testDb);
        const recentlyDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
        const regularFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: regularEntry.id,
          due: recentlyDueDate.toISOString(),
          due_timestamp_ms: recentlyDueDate.getTime(),
        });

        const backlogEntry = await insertDictionaryEntry(testDb);
        const oldDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
        const backlogFlashcard = await insertFlashcard(testDb, {
          dictionary_entry_id: backlogEntry.id,
          due: oldDueDate.toISOString(),
          due_timestamp_ms: oldDueDate.getTime(),
        });

        const results = await flashcardsTable.today.query({});

        expect(results.map((r) => r.id).sort()).toEqual(
          [regularFlashcard.id, backlogFlashcard.id].sort()
        );
      });
    });

    describe("hidden flashcards", () => {
      it("excludes hidden flashcards regardless of other filters", async () => {
        const entry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["foo"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: entry.id,
          state: FlashcardState.NEW,
          is_hidden: true,
        });

        const results = await flashcardsTable.today.query({
          filters: {
            types: ["ism"],
            state: [FlashcardState.NEW],
            tags: ["foo"],
          },
        });

        expect(results).toEqual([]);
      });
    });

    describe("nested dictionary_entry shape", () => {
      it("includes the full dictionary entry for each flashcard", async () => {
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
      });
    });

    describe("combined filters", () => {
      it("applies type, state, tags, and showReverse filters together", async () => {
        const matchEntry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["foo"],
        });
        const matchFlashcard = await insertFlashcard(testDb, {
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

        const wrongStateEntry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["foo"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: wrongStateEntry.id,
          state: FlashcardState.REVIEW,
          direction: "forward",
        });

        const wrongTagEntry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["bar"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: wrongTagEntry.id,
          state: FlashcardState.NEW,
          direction: "forward",
        });

        const reverseEntry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["foo"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: reverseEntry.id,
          state: FlashcardState.NEW,
          direction: "reverse",
        });

        const results = await flashcardsTable.today.query({
          filters: {
            types: ["ism"],
            state: [FlashcardState.NEW],
            tags: ["foo"],
          },
          showReverse: false,
        });

        expect(results.map((r) => r.id)).toEqual([matchFlashcard.id]);
      });
    });
  });

  describe("counts", () => {
    it("returns separate regular and backlog counts split by due date", async () => {
      const regularEntry = await insertDictionaryEntry(testDb);
      const recentlyDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
      await insertFlashcard(testDb, {
        dictionary_entry_id: regularEntry.id,
        due: recentlyDueDate.toISOString(),
        due_timestamp_ms: recentlyDueDate.getTime(),
      });

      const backlogEntry = await insertDictionaryEntry(testDb);
      const oldDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      await insertFlashcard(testDb, {
        dictionary_entry_id: backlogEntry.id,
        due: oldDueDate.toISOString(),
        due_timestamp_ms: oldDueDate.getTime(),
      });

      const result = await flashcardsTable.counts.query({});

      expect(result).toEqual({ regular: 1, backlog: 1, total: 2 });
    });

    it("excludes not-yet-due flashcards from regular, backlog, and total", async () => {
      // Unlike decksTable.list's total_hits (which counts regardless of due
      // date), counts.total is regular + backlog and both of those are
      // due-date-gated -- so a not-yet-due flashcard is excluded entirely,
      // not just left out of a "due" sub-bucket.
      const entry = await insertDictionaryEntry(testDb);
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2);
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
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

    it("excludes hidden flashcards from both regular and backlog counts", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        is_hidden: true,
      });

      const result = await flashcardsTable.counts.query({});

      expect(result).toEqual({ regular: 0, backlog: 0, total: 0 });
    });
  });

  describe("clearBacklog", () => {
    const consumeGenerator = async (
      generator: AsyncGenerator<{ cleared: number; total: number }>
    ) => {
      const progress: { cleared: number; total: number }[] = [];
      for await (const step of generator) {
        progress.push(step);
      }
      return progress;
    };

    it("reschedules all backlog flashcards by grading them as Hard", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const oldDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        due: oldDueDate.toISOString(),
        due_timestamp_ms: oldDueDate.getTime(),
        state: FlashcardState.NEW,
      });

      const progress = await consumeGenerator(
        flashcardsTable.clearBacklog.generator({})
      );

      expect(progress).toEqual([{ cleared: 1, total: 1 }]);

      const row = await testDb.db
        .prepare("SELECT * FROM flashcards WHERE id = ?")
        .get([flashcard.id]);

      expect(row.due_timestamp_ms).toBeGreaterThan(oldDueDate.getTime());
      expect(row.last_review).not.toBeNull();
    });

    it("does not touch flashcards outside the backlog window", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const recentlyDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        due: recentlyDueDate.toISOString(),
        due_timestamp_ms: recentlyDueDate.getTime(),
      });

      await consumeGenerator(flashcardsTable.clearBacklog.generator({}));

      const row = await testDb.db
        .prepare("SELECT * FROM flashcards WHERE id = ?")
        .get([flashcard.id]);

      expect(row.due_timestamp_ms).toBe(recentlyDueDate.getTime());
    });

    it("yields nothing and makes no changes when there's no backlog", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, { dictionary_entry_id: entry.id });

      const progress = await consumeGenerator(
        flashcardsTable.clearBacklog.generator({})
      );

      expect(progress).toEqual([]);
    });
  });
});
