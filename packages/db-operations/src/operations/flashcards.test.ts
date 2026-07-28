import {
  FlashcardState,
  type InsertFlashcard,
  type SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { startOfDay } from "date-fns";
import { Rating } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_POSTPONE_WINDOW_DAYS,
  MAX_POSTPONE_WINDOW_DAYS,
} from "../constants";
import { createTestDb, type TestDb } from "../test/create-test-db";
import {
  insertDictionaryEntry,
  insertFlashcard,
  insertSettings,
} from "../test/factories";
import {
  assignPostponedDueDates,
  clampPostponeWindow,
  type FlashcardWithDictionaryEntry,
  keepCurrentCardFirst,
  makeFlashcardsTable,
  postponeCardsPerDay,
} from "./flashcards";

const consumeGenerator = async (
  generator: AsyncGenerator<{ postponed: number; total: number }>
) => {
  const progress: { postponed: number; total: number }[] = [];
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

  describe("resetEntry", () => {
    it("resets both cards when the word has a forward and a reverse card", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
        state: FlashcardState.REVIEW,
        stability: 10,
        reps: 5,
      });
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "reverse",
        state: FlashcardState.REVIEW,
        stability: 8,
        reps: 3,
      });

      const results = await flashcardsTable.resetEntry.mutation({
        dictionary_entry_id: entry.id,
      });

      expect(results).toHaveLength(2);
      expect(
        results.map(({ flashcard }) => flashcard.direction).sort()
      ).toEqual(["forward", "reverse"]);

      for (const { flashcard } of results) {
        expect(flashcard).toMatchObject({
          state: FlashcardState.NEW,
          stability: 0,
          difficulty: 0,
          reps: 0,
          lapses: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          last_review: null,
        });
      }
    });

    // Regression: a word with no reverse row used to throw
    // "Flashcard not found ... direction: reverse" after the forward card had
    // already been written, leaving the reset half-done.
    it("resets the forward card of a word that has no reverse card", async () => {
      const entry = await insertDictionaryEntry(testDb);
      const forward = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
        state: FlashcardState.REVIEW,
        stability: 10,
        reps: 5,
      });

      const results = await flashcardsTable.resetEntry.mutation({
        dictionary_entry_id: entry.id,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.flashcard).toMatchObject({
        id: forward.id,
        direction: "forward",
        state: FlashcardState.NEW,
        stability: 0,
        reps: 0,
      });

      const stored = await flashcardsTable.findByEntryId.query(entry.id);

      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        id: forward.id,
        state: FlashcardState.NEW,
        stability: 0,
        reps: 0,
        last_review: null,
      });
    });

    it("returns a manual review log per reset card capturing its pre-reset state", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
        state: FlashcardState.REVIEW,
        stability: 10,
      });
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "reverse",
        state: FlashcardState.LEARNING,
        stability: 4,
      });

      const results = await flashcardsTable.resetEntry.mutation({
        dictionary_entry_id: entry.id,
      });

      // Callers post these logs to the revlog API, which is what puts a "reset"
      // entry in the review history. Each log is rated Manual and carries its
      // own card's pre-reset values, not the reset-to-NEW ones and not the
      // other direction's.
      const forwardLog = results.find(
        ({ flashcard }) => flashcard.direction === "forward"
      )?.log;
      const reverseLog = results.find(
        ({ flashcard }) => flashcard.direction === "reverse"
      )?.log;

      expect(forwardLog).toMatchObject({
        rating: Rating.Manual,
        state: FlashcardState.REVIEW,
        stability: 10,
      });
      expect(reverseLog).toMatchObject({
        rating: Rating.Manual,
        state: FlashcardState.LEARNING,
        stability: 4,
      });
    });

    it("returns an empty list for an entry with no flashcards at all", async () => {
      const entry = await insertDictionaryEntry(testDb);

      // Nothing to reset is not an error -- callers skip the revlog posts
      // instead of failing the whole reset.
      await expect(
        flashcardsTable.resetEntry.mutation({ dictionary_entry_id: entry.id })
      ).resolves.toEqual([]);
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

    it("returns cards ordered by due date ascending", async () => {
      // Inserted middle-first so a pass can't come from insert order.
      const twoDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);
      const fiveDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
      const justNow = new Date(Date.now() - 1000);

      const middle = await insertFlashcard(testDb, {
        due: twoDaysAgo.toISOString(),
        due_timestamp_ms: twoDaysAgo.getTime(),
      });
      const oldest = await insertFlashcard(testDb, {
        due: fiveDaysAgo.toISOString(),
        due_timestamp_ms: fiveDaysAgo.getTime(),
      });
      const newest = await insertFlashcard(testDb, {
        due: justNow.toISOString(),
        due_timestamp_ms: justNow.getTime(),
      });

      const results = await flashcardsTable.today.query({});

      expect(results.map((r) => r.id)).toEqual([
        oldest.id,
        middle.id,
        newest.id,
      ]);
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

  describe("assignPostponedDueDates", () => {
    // Local-time constructors on purpose: assignPostponedDueDates buckets by
    // startOfDay, which is local. A UTC ISO string would land at an arbitrary
    // local hour depending on the runner's TZ and make the clamp assertions
    // non-deterministic.
    const MID_AFTERNOON = new Date(2026, 2, 10, 15, 0, 0);
    const JUST_AFTER_MIDNIGHT = new Date(2026, 2, 10, 0, 0, 3);

    /** Groups results by local calendar day, keyed by that day's midnight. */
    const byDay = (
      results: Pick<SelectFlashcard, "id" | "due" | "due_timestamp_ms">[]
    ) => {
      const days = new Map<number, string[]>();
      for (const r of results) {
        const key = startOfDay(new Date(r.due_timestamp_ms)).getTime();
        days.set(key, [...(days.get(key) ?? []), r.id]);
      }
      return days;
    };

    it("deals cards round-robin so each day gets a representative slice", () => {
      const now = MID_AFTERNOON;
      const cards = Array.from({ length: 14 }, (_, i) => ({ id: `card-${i}` }));

      const result = assignPostponedDueDates({ cards, now, windowDays: 7 });
      expect(result).toHaveLength(cards.length);

      const days = byDay(result);

      // Round-robin, not sliced blocks: cards 0 and 7 share day 0, cards 1 and
      // 8 share day 1, and so on. Callers pass cards in due order, so this is
      // what gives every day a mix of mildly- and severely-overdue cards.
      const dayKeys = [...days.keys()].sort((a, b) => a - b);
      expect(dayKeys).toHaveLength(7);
      dayKeys.forEach((key, day) => {
        expect(days.get(key)).toEqual([`card-${day}`, `card-${day + 7}`]);
      });

      // Every input card appears exactly once.
      expect(new Set(result.map((r) => r.id))).toEqual(
        new Set(cards.map((c) => c.id))
      );
    });

    it("starts the window today rather than tomorrow", () => {
      const now = MID_AFTERNOON;

      const [only] = assignPostponedDueDates({
        cards: [{ id: "card-0" }],
        now,
        windowDays: 7,
      });

      // Already due, so postpone leaves the user something to review
      // immediately instead of an empty queue.
      expect(only.due_timestamp_ms).toBeLessThanOrEqual(now.getTime());
      expect(startOfDay(new Date(only.due_timestamp_ms)).getTime()).toBe(
        startOfDay(now).getTime()
      );
    });

    it("clamps day 0 to now so today's cards never land in the future", () => {
      // Three seconds past midnight: day 0's stagger (1s per card) would run
      // past `now` from the 4th day-0 card onward without the clamp.
      const now = JUST_AFTER_MIDNIGHT;
      const cards = Array.from({ length: 70 }, (_, i) => ({ id: `card-${i}` }));

      const result = assignPostponedDueDates({ cards, now, windowDays: 7 });

      const dayZero = result.filter((_, i) => i % 7 === 0);
      expect(dayZero).toHaveLength(10);
      for (const card of dayZero) {
        // A future timestamp would drop the card out of `today`'s
        // `due <= now` filter and silently vanish it from the queue.
        expect(card.due_timestamp_ms).toBeLessThanOrEqual(now.getTime());
      }
    });

    it("staggers cards within a day so due order is deterministic", () => {
      const now = MID_AFTERNOON;
      const cards = Array.from({ length: 14 }, (_, i) => ({ id: `card-${i}` }));

      const result = assignPostponedDueDates({ cards, now, windowDays: 7 });

      // Sharing one timestamp would leave the pair's relative order in
      // `today`'s ORDER BY up to SQLite.
      expect(result[7].due_timestamp_ms - result[0].due_timestamp_ms).toBe(
        1000
      );
      expect(result[8].due_timestamp_ms - result[1].due_timestamp_ms).toBe(
        1000
      );
      expect(new Set(result.map((r) => r.due_timestamp_ms)).size).toBe(14);
    });

    it("keeps due and due_timestamp_ms in sync", () => {
      const cards = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}` }));

      const result = assignPostponedDueDates({
        cards,
        now: MID_AFTERNOON,
        windowDays: 7,
      });

      // Twins in the schema -- a mismatch means one query path reads a
      // different schedule than another.
      for (const r of result) {
        expect(new Date(r.due).getTime()).toBe(r.due_timestamp_ms);
      }
    });

    it("spreads over fewer days than the window when cards are scarce", () => {
      const now = MID_AFTERNOON;
      const cards = Array.from({ length: 3 }, (_, i) => ({ id: `card-${i}` }));

      const result = assignPostponedDueDates({ cards, now, windowDays: 7 });

      // One card each on days 0, 1, 2 -- no doubling up, no attempt to fill
      // all 7 days.
      const days = byDay(result);
      expect(days.size).toBe(3);
      for (const ids of days.values()) {
        expect(ids).toHaveLength(1);
      }
    });

    it("returns an empty array for no cards", () => {
      // The generator leans on this to no-op without opening a transaction.
      expect(
        assignPostponedDueDates({
          cards: [],
          now: MID_AFTERNOON,
          windowDays: 7,
        })
      ).toEqual([]);
    });

    it("treats a window of 0 or less as a single day", () => {
      const now = MID_AFTERNOON;
      const cards = Array.from({ length: 4 }, (_, i) => ({ id: `card-${i}` }));

      for (const windowDays of [0, -1]) {
        const result = assignPostponedDueDates({ cards, now, windowDays });

        // `index % 0` is NaN, which would produce Invalid Date timestamps, so
        // the floor of 1 day matters.
        expect(byDay(result).size).toBe(1);
        for (const r of result) {
          expect(Number.isNaN(r.due_timestamp_ms)).toBe(false);
          expect(r.due_timestamp_ms).toBeLessThanOrEqual(now.getTime());
        }
      }
    });
  });

  describe("clampPostponeWindow", () => {
    it("caps the window at the card count, not just the hard maximum", () => {
      // Spreading 5 cards over 20 days would leave 15 days empty, so the pile
      // size is the real ceiling below MAX_POSTPONE_WINDOW_DAYS.
      expect(clampPostponeWindow({ windowDays: 20, cardCount: 5 })).toBe(5);
      expect(clampPostponeWindow({ windowDays: 3, cardCount: 5 })).toBe(3);
    });

    it("caps at the hard maximum once the pile is large enough", () => {
      expect(clampPostponeWindow({ windowDays: 999, cardCount: 5000 })).toBe(
        MAX_POSTPONE_WINDOW_DAYS
      );
    });

    it("floors at one day for zero, negative, and fractional input", () => {
      expect(clampPostponeWindow({ windowDays: 0, cardCount: 100 })).toBe(1);
      expect(clampPostponeWindow({ windowDays: -5, cardCount: 100 })).toBe(1);
      expect(clampPostponeWindow({ windowDays: 1.9, cardCount: 100 })).toBe(1);
    });

    it("survives NaN rather than propagating it into a due timestamp", () => {
      // Number("") is 0 and Number("abc") is NaN -- both reachable straight
      // from the settings text field.
      expect(
        clampPostponeWindow({ windowDays: Number.NaN, cardCount: 100 })
      ).toBe(1);
      expect(
        clampPostponeWindow({
          windowDays: Number.POSITIVE_INFINITY,
          cardCount: 100,
        })
      ).toBe(1);
    });

    it("returns a usable window even with nothing to postpone", () => {
      // Callers disable the action at zero; this just must not return 0 or
      // negative and hand `assignPostponedDueDates` an unusable window.
      expect(clampPostponeWindow({ windowDays: 7, cardCount: 0 })).toBe(1);
    });
  });

  describe("postponeCardsPerDay", () => {
    it("rounds up to match what the round-robin deal actually produces", () => {
      // 743 over 7 days is 106.1; the first 743 % 7 days get 107, so the
      // honest headline number is the ceiling.
      expect(postponeCardsPerDay({ cardCount: 743, windowDays: 7 })).toBe(107);
      expect(postponeCardsPerDay({ cardCount: 700, windowDays: 7 })).toBe(100);
    });

    it("never divides by zero", () => {
      expect(postponeCardsPerDay({ cardCount: 50, windowDays: 0 })).toBe(50);
    });
  });

  describe("postpone", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    /** Inserts an overdue card on its own dictionary entry. */
    const insertOverdue = async (
      daysOverdue: number,
      overrides: Partial<InsertFlashcard> = {}
    ) => {
      const entry = await insertDictionaryEntry(testDb);
      const due = new Date(Date.now() - daysOverdue * DAY_MS);
      return insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        due: due.toISOString(),
        due_timestamp_ms: due.getTime(),
        state: FlashcardState.REVIEW,
        ...overrides,
      });
    };

    const readRow = async (id: string) =>
      (await (
        await testDb.db.prepare("SELECT * FROM flashcards WHERE id = ?")
      ).get([id])) as Record<string, unknown>;

    const readAllDue = async () =>
      (await (
        await testDb.db.prepare("SELECT id, due_timestamp_ms FROM flashcards")
      ).all([])) as { id: string; due_timestamp_ms: number }[];

    it("moves due dates forward without touching any memory-model field", async () => {
      // THE load-bearing test for this feature. FSRS treats `due` as a
      // scheduler output; stability/difficulty/last_review/state and the
      // counters are the memory model's own state. Postpone must rewrite only
      // the former. If this test fails, postpone has started corrupting the
      // user's memory estimates.
      const lastReview = new Date(Date.now() - 60 * DAY_MS);
      const flashcard = await insertOverdue(30, {
        stability: 42.5,
        difficulty: 6.25,
        reps: 9,
        lapses: 3,
        elapsed_days: 55,
        scheduled_days: 25,
        learning_steps: 2,
        last_review: lastReview.toISOString(),
        last_review_timestamp_ms: lastReview.getTime(),
      });

      const before = await readRow(flashcard.id);

      const progress = await consumeGenerator(
        flashcardsTable.postpone.generator({})
      );
      expect(progress).toEqual([{ postponed: 1, total: 1 }]);

      const after = await readRow(flashcard.id);

      // Due moved forward, into the window starting today.
      expect(after.due_timestamp_ms).not.toBe(before.due_timestamp_ms);
      expect(after.due_timestamp_ms as number).toBeGreaterThan(
        before.due_timestamp_ms as number
      );
      expect(after.due_timestamp_ms as number).toBeLessThanOrEqual(
        startOfDay(new Date()).getTime() + DEFAULT_POSTPONE_WINDOW_DAYS * DAY_MS
      );

      // Comparing whole rows minus the two due columns, rather than naming
      // each FSRS field: a newly added column is then covered automatically
      // instead of slipping through unchecked.
      const {
        due: _beforeDue,
        due_timestamp_ms: _beforeMs,
        ...beforeRest
      } = before;
      const {
        due: _afterDue,
        due_timestamp_ms: _afterMs,
        ...afterRest
      } = after;
      expect(afterRest).toEqual(beforeRest);
    });

    it("reschedules every card correctly when batching multiple cards in one chunk", async () => {
      // Guards the batched `UPDATE ... FROM (VALUES ...)` path: with >1 card in
      // a single chunk, each row's new due date must land on its own card and
      // not bleed across rows (column1..column3 positional mapping). Each card
      // gets a distinct `lapses` fingerprint -- postpone never writes lapses,
      // so a misaligned mapping surfaces as a mismatched fingerprint.
      const N = 5;
      const cards: { id: string; lapses: number }[] = [];
      for (let i = 0; i < N; i++) {
        const flashcard = await insertOverdue(30 + i, { lapses: i });
        cards.push({ id: flashcard.id, lapses: i });
      }

      const progress = await consumeGenerator(
        flashcardsTable.postpone.generator({})
      );

      // All N fit in one CHUNK_SIZE=100 chunk -> a single progress step.
      expect(progress).toEqual([{ postponed: N, total: N }]);

      for (const { id, lapses } of cards) {
        const row = await readRow(id);
        expect(row.lapses).toBe(lapses);
      }

      // Round-robin over a 7-day window puts 5 cards on 5 separate days.
      const rows = await readAllDue();
      const days = new Set(
        rows.map((r) => startOfDay(new Date(r.due_timestamp_ms)).getTime())
      );
      expect(days.size).toBe(N);
    });

    it("spans multiple chunks and reports cumulative progress across them", async () => {
      // Guards chunking when the pile exceeds CHUNK_SIZE (100): no card is
      // dropped at the boundary and progress is cumulative across chunks.
      const total = 105;
      for (let i = 0; i < total; i++) {
        await insertOverdue(30 + i);
      }

      const progress = await consumeGenerator(
        flashcardsTable.postpone.generator({})
      );

      expect(progress).toEqual([
        { postponed: 100, total },
        { postponed: 105, total },
      ]);

      // Nothing left behind at the chunk boundary: every card now sits inside
      // the window, so none is still deep in the past.
      const stale = (await (
        await testDb.db.prepare(
          "SELECT COUNT(*) AS cnt FROM flashcards WHERE due_timestamp_ms < ?"
        )
      ).get([startOfDay(new Date()).getTime()])) as { cnt: number };
      expect(stale.cnt).toBe(0);
    });

    it("spreads the pile across the whole window rather than dumping it on one day", async () => {
      // The behavioural promise the copy makes -- "spread over 7 days" has to
      // actually distribute the cards.
      const total = 70;
      for (let i = 0; i < total; i++) {
        await insertOverdue(30 + i);
      }

      await consumeGenerator(flashcardsTable.postpone.generator({}));

      const rows = await readAllDue();
      const perDay = new Map<number, number>();
      for (const r of rows) {
        const key = startOfDay(new Date(r.due_timestamp_ms)).getTime();
        perDay.set(key, (perDay.get(key) ?? 0) + 1);
      }

      expect(perDay.size).toBe(DEFAULT_POSTPONE_WINDOW_DAYS);
      for (const count of perDay.values()) {
        expect(count).toBe(total / DEFAULT_POSTPONE_WINDOW_DAYS);
      }
    });

    it("moves all currently-due cards when scope is 'all'", async () => {
      const deep = await insertOverdue(30);
      const mild = await insertOverdue(1);

      const progress = await consumeGenerator(
        flashcardsTable.postpone.generator({ scope: "all" })
      );
      expect(progress).toEqual([{ postponed: 2, total: 2 }]);

      // "all" ignores backlogThresholdDays entirely, so a card only 1 day
      // overdue is still fair game.
      expect((await readRow(deep.id)).due_timestamp_ms).not.toBe(
        deep.due_timestamp_ms
      );
      expect((await readRow(mild.id)).due_timestamp_ms).not.toBe(
        mild.due_timestamp_ms
      );
    });

    it("leaves mildly-overdue cards alone when scope is 'backlog'", async () => {
      const deep = await insertOverdue(30);
      const mild = await insertOverdue(1);

      const progress = await consumeGenerator(
        flashcardsTable.postpone.generator({ scope: "backlog" })
      );
      expect(progress).toEqual([{ postponed: 1, total: 1 }]);

      expect((await readRow(deep.id)).due_timestamp_ms).not.toBe(
        deep.due_timestamp_ms
      );
      // Stays due today -- which is exactly what the backlog-scope copy
      // promises the user.
      expect((await readRow(mild.id)).due_timestamp_ms).toBe(
        mild.due_timestamp_ms
      );
    });

    it("never moves cards that aren't due yet", async () => {
      const future = new Date(Date.now() + 3 * DAY_MS);
      const flashcard = await insertFlashcard(testDb, {
        due: future.toISOString(),
        due_timestamp_ms: future.getTime(),
        state: FlashcardState.REVIEW,
      });

      // Postpone is a recovery action; it must not push a healthy schedule
      // around under either scope.
      for (const scope of ["all", "backlog"] as const) {
        await consumeGenerator(flashcardsTable.postpone.generator({ scope }));
        expect((await readRow(flashcard.id)).due_timestamp_ms).toBe(
          future.getTime()
        );
      }
    });

    it("respects deck filters", async () => {
      const ismEntry = await insertDictionaryEntry(testDb, { type: "ism" });
      const filEntry = await insertDictionaryEntry(testDb, { type: "fi'l" });
      const overdue = new Date(Date.now() - 30 * DAY_MS);

      const ismCard = await insertFlashcard(testDb, {
        dictionary_entry_id: ismEntry.id,
        due: overdue.toISOString(),
        due_timestamp_ms: overdue.getTime(),
        state: FlashcardState.REVIEW,
      });
      const filCard = await insertFlashcard(testDb, {
        dictionary_entry_id: filEntry.id,
        due: overdue.toISOString(),
        due_timestamp_ms: overdue.getTime(),
        state: FlashcardState.REVIEW,
      });

      await consumeGenerator(
        flashcardsTable.postpone.generator({ filters: { types: ["ism"] } })
      );

      // Shares buildFilterConditions with today/counts, so type/tag/state
      // filtering behaves identically here.
      expect((await readRow(ismCard.id)).due_timestamp_ms).not.toBe(
        overdue.getTime()
      );
      expect((await readRow(filCard.id)).due_timestamp_ms).toBe(
        overdue.getTime()
      );
    });

    it("skips hidden flashcards", async () => {
      const hidden = await insertOverdue(30, { is_hidden: true });

      const progress = await consumeGenerator(
        flashcardsTable.postpone.generator({})
      );

      // Hidden cards are out of the review system entirely, so they're not
      // rescheduled and don't inflate the progress total.
      expect(progress).toEqual([]);
      expect((await readRow(hidden.id)).due_timestamp_ms).toBe(
        hidden.due_timestamp_ms
      );
    });

    it("yields nothing and makes no changes when there's nothing overdue", async () => {
      const future = new Date(Date.now() + 2 * DAY_MS);
      const flashcard = await insertFlashcard(testDb, {
        due: future.toISOString(),
        due_timestamp_ms: future.getTime(),
      });

      const progress = await consumeGenerator(
        flashcardsTable.postpone.generator({})
      );

      // Returns before opening a transaction.
      expect(progress).toEqual([]);
      expect((await readRow(flashcard.id)).due_timestamp_ms).toBe(
        future.getTime()
      );
    });

    it("leaves the pile untouched when a chunk fails mid-transaction", async () => {
      // Two chunks' worth, so the first UPDATE succeeds before the second
      // fails -- that's the case where a missing ROLLBACK would leave half the
      // pile moved.
      const total = 105;
      for (let i = 0; i < total; i++) {
        await insertOverdue(30 + i);
      }
      const before = new Map(
        (await readAllDue()).map((r) => [r.id, r.due_timestamp_ms])
      );

      // Call order is BEGIN, UPDATE (chunk 1), UPDATE (chunk 2), COMMIT --
      // fail the third so the transaction is already dirty. ROLLBACK is call
      // four and must still reach the real implementation.
      const realRun = testDb.drizzleDb.run.bind(testDb.drizzleDb);
      let runCalls = 0;
      const runSpy = vi.spyOn(testDb.drizzleDb, "run").mockImplementation(((
        query: Parameters<typeof realRun>[0]
      ) => {
        runCalls += 1;
        if (runCalls === 3) {
          throw new Error("simulated chunk failure");
        }
        return realRun(query);
      }) as typeof realRun);

      try {
        await expect(
          consumeGenerator(flashcardsTable.postpone.generator({}))
        ).rejects.toThrow("simulated chunk failure");
      } finally {
        runSpy.mockRestore();
      }

      // A partial postpone would leave the schedule in a state the user can't
      // reason about, so chunk 1 has to be rolled back too.
      for (const row of await readAllDue()) {
        expect(row.due_timestamp_ms).toBe(before.get(row.id));
      }
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

describe("keepCurrentCardFirst", () => {
  // Pure helper -- only `id` is read, so plain objects stand in for full cards.
  const card = (id: string) => ({ id }) as FlashcardWithDictionaryEntry;
  const a = card("a");
  const b = card("b");
  const c = card("c");

  it("keeps the card under review at index 0 when new cards join the queue", () => {
    const result = keepCurrentCardFirst({
      prev: [a, b],
      next: [c, a, b],
    });

    expect(result.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("keeps the card under review at index 0 regardless of how next is ordered", () => {
    // The actual BAH-174 guarantee: independent of today's ORDER BY, so changing
    // the query's sort can't reopen the bug.
    for (const next of [
      [a, b, c],
      [c, b, a],
      [b, c, a],
    ]) {
      const result = keepCurrentCardFirst({ prev: [a, b], next });

      expect(result[0].id).toBe("a");
      expect(result).toHaveLength(3);
    }
  });

  it("drops cards the refetch says are no longer due", () => {
    const result = keepCurrentCardFirst({ prev: [a, b], next: [a] });

    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("falls back to the refetched order when the current card is gone", () => {
    const result = keepCurrentCardFirst({ prev: [a, b], next: [b, c] });

    expect(result.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("returns the refetched queue when there was nothing on screen", () => {
    const result = keepCurrentCardFirst({ prev: [], next: [a, b] });

    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
