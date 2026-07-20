import {
  FlashcardState,
  type SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { Rating } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import {
  insertDictionaryEntry,
  insertFlashcard,
  insertSettings,
} from "../test/factories";
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

      expect(reset.flashcard).toMatchObject({
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

    it("returns a manual review log capturing the pre-reset state", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
        state: FlashcardState.REVIEW,
        stability: 10,
      });

      const reset = await flashcardsTable.reset.mutation({
        dictionary_entry_id: entry.id,
        direction: "forward",
      });

      // The log is rated Manual (the reset marker) and records the card's
      // state/stability from before the wipe, not the reset-to-NEW values.
      expect(reset.log.rating).toBe(Rating.Manual);
      expect(reset.log.state).toBe(FlashcardState.REVIEW);
      expect(reset.log.stability).toBe(10);
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

    it("includes both forward and reverse cards (row presence, no global gate)", async () => {
      // Reverse cards are no longer gated by a setting -- whatever reverse rows
      // exist are studied. A word only has a reverse card if one was created for
      // it (create-time default or per-word toggle), so simply include both.
      const entry = await insertDictionaryEntry(testDb);
      const forward = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
      });
      const reverse = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "reverse",
      });

      const results = await flashcardsTable.today.query({});
      expect(results.map((r) => r.id).sort()).toEqual(
        [forward.id, reverse.id].sort()
      );
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

    it("returns entries whose text fields contain double quotes and backslashes verbatim (BAH-138)", async () => {
      // Regression: the query previously hand-built json_object() with manual
      // REPLACE escaping, which double-escaped quotes on top of json_object's
      // own escaping and produced malformed JSON. Values must round-trip
      // unchanged through the drizzle nested select.
      const entry = await insertDictionaryEntry(testDb, {
        word: "تنحنح",
        translation: 'to clear one\'s throat (say "ahem")',
        definition: 'path\\to\\thing and a trailing quote"',
      });
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
      });

      const results = await flashcardsTable.today.query({});
      const result = results.find((r) => r.id === flashcard.id);

      expect(result?.dictionary_entry).toMatchObject({
        id: entry.id,
        word: "تنحنح",
        translation: 'to clear one\'s throat (say "ahem")',
        definition: 'path\\to\\thing and a trailing quote"',
      });
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

    it("applies the same type/state/tags filters as today.query", async () => {
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

    it("reschedules every card correctly when batching multiple cards in one chunk", async () => {
      // Guards the batched `UPDATE ... FROM (VALUES ...)` path: with >1 card in
      // a single chunk, each row's new schedule must land on its own card and
      // not bleed across rows (column1..column12 positional mapping). Each card
      // gets a distinct `lapses` value as a fingerprint -- grading Hard never
      // adds a lapse, so it must round-trip unchanged onto the SAME card; a
      // misaligned column/row mapping would surface as a mismatched lapses.
      const N = 5;
      const oldDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      const lastReview = new Date(Date.now() - 1000 * 60 * 60 * 24 * 20);

      const cards = await Promise.all(
        Array.from({ length: N }, async (_, i) => {
          const entry = await insertDictionaryEntry(testDb);
          const flashcard = await insertFlashcard(testDb, {
            dictionary_entry_id: entry.id,
            due: oldDue.toISOString(),
            due_timestamp_ms: oldDue.getTime(),
            state: FlashcardState.REVIEW,
            stability: 10 + i,
            difficulty: 5,
            reps: 3 + i,
            lapses: i, // distinct fingerprint: 0,1,2,3,4
            last_review: lastReview.toISOString(),
            last_review_timestamp_ms: lastReview.getTime(),
          });
          return { entry, flashcard, lapses: i };
        })
      );

      const postRevlogBatch = vi.fn<(e: ClearBacklogRevlogEntry[]) => void>();
      const table = makeFlashcardsTable(
        { getDb: async () => testDb.drizzleDb },
        { postRevlogBatch }
      );

      const progress = await consumeGenerator(table.clearBacklog.generator({}));

      // All N fit in one CHUNK_SIZE=100 chunk -> a single progress step.
      expect(progress).toEqual([{ cleared: N, total: N }]);

      for (const { flashcard, lapses } of cards) {
        const row = (await (
          await testDb.db.prepare("SELECT * FROM flashcards WHERE id = ?")
        ).get([flashcard.id])) as {
          due_timestamp_ms: number;
          last_review: string | null;
          lapses: number;
        };

        // Rescheduled: due moved forward past its own old value, review logged.
        expect(row.due_timestamp_ms).toBeGreaterThan(oldDue.getTime());
        expect(row.last_review).not.toBeNull();
        // Fingerprint landed on the right card (no cross-row/column bleed).
        expect(row.lapses).toBe(lapses);
      }

      // One revlog per card, exactly the N cards we inserted.
      expect(postRevlogBatch).toHaveBeenCalledTimes(1);
      const entries = postRevlogBatch.mock.calls[0][0];
      expect(entries).toHaveLength(N);
      expect(new Set(entries.map((e) => e.dictionary_entry_id))).toEqual(
        new Set(cards.map((c) => c.entry.id))
      );
    });

    it("spans multiple chunks and reports cumulative progress across them", async () => {
      // Guards chunking when the backlog exceeds CHUNK_SIZE (100): no card is
      // dropped at the boundary and progress is cumulative across chunks.
      const total = 105;
      const oldDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);

      await Promise.all(
        Array.from({ length: total }, async () => {
          const entry = await insertDictionaryEntry(testDb);
          await insertFlashcard(testDb, {
            dictionary_entry_id: entry.id,
            due: oldDue.toISOString(),
            due_timestamp_ms: oldDue.getTime(),
            state: FlashcardState.NEW,
          });
        })
      );

      const postRevlogBatch = vi.fn<(e: ClearBacklogRevlogEntry[]) => void>();
      const table = makeFlashcardsTable(
        { getDb: async () => testDb.drizzleDb },
        { postRevlogBatch }
      );

      const progress = await consumeGenerator(table.clearBacklog.generator({}));

      // Cumulative, chunked at CHUNK_SIZE=100.
      expect(progress).toEqual([
        { cleared: 100, total },
        { cleared: 105, total },
      ]);

      // Every card rescheduled -- none skipped at the chunk boundary.
      const remaining = (await (
        await testDb.db.prepare(
          "SELECT COUNT(*) AS cnt FROM flashcards WHERE due_timestamp_ms <= ?"
        )
      ).get([oldDue.getTime()])) as { cnt: number };
      expect(remaining.cnt).toBe(0);

      expect(postRevlogBatch).toHaveBeenCalledTimes(1);
      expect(postRevlogBatch.mock.calls[0][0]).toHaveLength(total);
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
    it("creates only a forward card when create_reverse_by_default is off", async () => {
      // Default (no settings row) is off -- reverse is opt-in per word now.
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
      expect(reverse).toBeNull();

      const all = await flashcardsTable.findByEntryId.query(entry.id);
      expect(all).toHaveLength(1);
    });

    it("creates forward + reverse when create_reverse_by_default is on", async () => {
      await insertSettings(testDb, { create_reverse_by_default: true });
      const entry = await insertDictionaryEntry(testDb);

      const { forward, reverse } =
        await flashcardsTable.createFlashcardPair.mutation({
          dictionary_entry_id: entry.id,
        });

      expect(forward).toMatchObject({
        dictionary_entry_id: entry.id,
        direction: "forward",
        state: FlashcardState.NEW,
      });
      expect(reverse).toMatchObject({
        dictionary_entry_id: entry.id,
        direction: "reverse",
        state: FlashcardState.NEW,
      });

      const all = await flashcardsTable.findByEntryId.query(entry.id);
      expect(all).toHaveLength(2);
    });

    it("honors an explicit createReverse override over the setting", async () => {
      // Setting is on, but the per-word override wins (add-word form opting out).
      await insertSettings(testDb, { create_reverse_by_default: true });
      const entry = await insertDictionaryEntry(testDb);

      const { reverse } = await flashcardsTable.createFlashcardPair.mutation({
        dictionary_entry_id: entry.id,
        createReverse: false,
      });

      expect(reverse).toBeNull();
      const all = await flashcardsTable.findByEntryId.query(entry.id);
      expect(all).toHaveLength(1);
    });
  });

  describe("setReverse", () => {
    it("creates a reverse card born due now when enabling", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const before = Date.now();

      const { reverse } = await flashcardsTable.setReverse.mutation({
        dictionary_entry_id: entry.id,
        enabled: true,
      });

      expect(reverse).toMatchObject({
        dictionary_entry_id: entry.id,
        direction: "reverse",
        state: FlashcardState.NEW,
      });
      // Born due now -> "due today", never surfaces as backlog.
      expect(reverse?.due_timestamp_ms).toBeGreaterThanOrEqual(before - 1000);
      expect(reverse?.due_timestamp_ms).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it("is idempotent when enabling twice (one reverse card)", async () => {
      const entry = await insertDictionaryEntry(testDb);

      const first = await flashcardsTable.setReverse.mutation({
        dictionary_entry_id: entry.id,
        enabled: true,
      });
      const second = await flashcardsTable.setReverse.mutation({
        dictionary_entry_id: entry.id,
        enabled: true,
      });

      expect(second.reverse?.id).toBe(first.reverse?.id);
      const all = await flashcardsTable.findByEntryId.query(entry.id);
      expect(all.filter((c) => c.direction === "reverse")).toHaveLength(1);
    });

    it("deletes the reverse card when disabling", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await flashcardsTable.setReverse.mutation({
        dictionary_entry_id: entry.id,
        enabled: true,
      });

      const { reverse } = await flashcardsTable.setReverse.mutation({
        dictionary_entry_id: entry.id,
        enabled: false,
      });

      expect(reverse).toBeNull();
      const all = await flashcardsTable.findByEntryId.query(entry.id);
      expect(all.filter((c) => c.direction === "reverse")).toHaveLength(0);
    });

    it("disabling when no reverse card exists is a no-op", async () => {
      const entry = await insertDictionaryEntry(testDb);

      const { reverse } = await flashcardsTable.setReverse.mutation({
        dictionary_entry_id: entry.id,
        enabled: false,
      });

      expect(reverse).toBeNull();
    });
  });
});
