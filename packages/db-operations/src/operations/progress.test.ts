import { FlashcardState, userStats } from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import { insertDictionaryEntry, insertFlashcard } from "../test/factories";
import { makeProgressTable } from "./progress";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formats a date as YYYY-MM-DD in a timezone, matching progress.ts's internal
 * formatDateInTz so tests can construct last_review_date values the operation
 * will compare equal to its own getToday/getYesterday.
 */
const isoDateInTz = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const todayUtc = () => isoDateInTz(new Date(), "UTC");
const yesterdayUtc = () => isoDateInTz(new Date(Date.now() - DAY_MS), "UTC");
const daysAgoUtc = (n: number) =>
  isoDateInTz(new Date(Date.now() - n * DAY_MS), "UTC");

describe("progressTable", () => {
  let testDb: TestDb;
  let progressTable: ReturnType<typeof makeProgressTable>;

  beforeEach(async () => {
    testDb = await createTestDb();
    progressTable = makeProgressTable({ getDb: async () => testDb.drizzleDb });
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("wordsAdded", () => {
    it("counts all entries and those created within the last week", async () => {
      const now = Date.now();

      await insertDictionaryEntry(testDb, {
        created_at_timestamp_ms: now - 1000,
      });
      await insertDictionaryEntry(testDb, {
        created_at_timestamp_ms: now - 2000,
      });
      await insertDictionaryEntry(testDb, {
        created_at_timestamp_ms: now - WEEK_MS - 1000,
      });

      const result = await progressTable.wordsAdded.query();

      expect(result).toEqual({ total: 3, thisWeek: 2 });
    });
  });

  describe("wordsLearned", () => {
    it("counts distinct entries with a flashcard in REVIEW state, and this-week reviews", async () => {
      const now = Date.now();

      const learnedEntry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: learnedEntry.id,
        state: FlashcardState.REVIEW,
        last_review_timestamp_ms: now - 1000,
      });

      const oldReviewEntry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: oldReviewEntry.id,
        state: FlashcardState.REVIEW,
        last_review_timestamp_ms: now - WEEK_MS - 1000,
      });

      const newEntry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: newEntry.id,
        state: FlashcardState.NEW,
      });

      const result = await progressTable.wordsLearned.query();

      expect(result.learned).toBe(2);
      expect(result.totalAdded).toBe(3);
      expect(result.thisWeek).toBe(1);
    });

    it("excludes hidden flashcards from the learned count", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        state: FlashcardState.REVIEW,
        is_hidden: true,
      });

      const result = await progressTable.wordsLearned.query();

      expect(result.learned).toBe(0);
    });
  });

  describe("difficultWords", () => {
    it("returns entries with difficulty > 7, capped at 3, ordered by max difficulty desc", async () => {
      // difficulties 8,9,10,11 each on their own entry -> top 3 are 11,10,9;
      // total counts all 4 distinct difficult entries. A difficulty-5 entry is
      // excluded entirely.
      const byDifficulty = new Map<number, string>();
      for (const difficulty of [8, 9, 10, 11]) {
        const entry = await insertDictionaryEntry(testDb);
        await insertFlashcard(testDb, {
          dictionary_entry_id: entry.id,
          difficulty,
        });
        byDifficulty.set(difficulty, entry.id);
      }
      const easyEntry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: easyEntry.id,
        difficulty: 5,
      });

      const result = await progressTable.difficultWords.query();

      expect(result.total).toBe(4);
      expect(result.words).toHaveLength(3);
      expect(result.words.map((w) => w.entryId)).toEqual([
        byDifficulty.get(11),
        byDifficulty.get(10),
        byDifficulty.get(9),
      ]);
    });

    it("flags bothDirections when an entry has forward and reverse difficult cards", async () => {
      const entry = await insertDictionaryEntry(testDb);
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "forward",
        difficulty: 9,
      });
      await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
        direction: "reverse",
        difficulty: 10,
      });

      const result = await progressTable.difficultWords.query();

      expect(result.words).toHaveLength(1);
      expect(result.words[0]).toMatchObject({
        entryId: entry.id,
        bothDirections: true,
      });
    });
  });

  describe("workloadForecast", () => {
    // Noon avoids DST/day-boundary edges; day 0 is tomorrow, so a card due
    // tomorrow lands in days[0] and one due in 3 days lands in days[2].
    const noonDaysFromNow = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      d.setHours(12, 0, 0, 0);
      return d.getTime();
    };

    it("buckets due cards into the next 7 days starting tomorrow", async () => {
      await insertFlashcard(testDb, {
        due_timestamp_ms: noonDaysFromNow(1),
      });
      await insertFlashcard(testDb, {
        due_timestamp_ms: noonDaysFromNow(3),
      });

      const result = await progressTable.workloadForecast.query({
        showReverse: false,
        locale: "en-US",
      });

      expect(result.days).toHaveLength(7);
      expect(result.days[0].count).toBe(1);
      expect(result.days[2].count).toBe(1);
      expect(result.tomorrowCount).toBe(result.days[0].count);
    });

    it("includes reverse-direction cards only when showReverse is true", async () => {
      await insertFlashcard(testDb, {
        direction: "forward",
        due_timestamp_ms: noonDaysFromNow(1),
      });
      await insertFlashcard(testDb, {
        direction: "reverse",
        due_timestamp_ms: noonDaysFromNow(1),
      });

      const forwardOnly = await progressTable.workloadForecast.query({
        showReverse: false,
        locale: "en-US",
      });
      const both = await progressTable.workloadForecast.query({
        showReverse: true,
        locale: "en-US",
      });

      expect(forwardOnly.tomorrowCount).toBe(1);
      expect(both.tomorrowCount).toBe(2);
    });
  });

  describe("recentReviewWords", () => {
    it("returns a map of entryId -> {word, translation} for the given ids", async () => {
      const a = await insertDictionaryEntry(testDb, {
        word: "أ",
        translation: "a",
      });
      const b = await insertDictionaryEntry(testDb, {
        word: "ب",
        translation: "b",
      });

      const result = await progressTable.recentReviewWords.query([a.id, b.id]);

      expect(result.get(a.id)).toEqual({ word: "أ", translation: "a" });
      expect(result.get(b.id)).toEqual({ word: "ب", translation: "b" });
    });

    it("returns an empty map for an empty id list", async () => {
      const result = await progressTable.recentReviewWords.query([]);
      expect(result.size).toBe(0);
    });
  });

  describe("streak", () => {
    it("returns zeros when no userStats row exists", async () => {
      const result = await progressTable.streak.query();
      expect(result).toEqual({
        streakCount: 0,
        longestStreak: 0,
        reviewedToday: false,
      });
    });

    it("reports reviewedToday true when last_review_date is today", async () => {
      await testDb.drizzleDb.insert(userStats).values({
        id: "stats-1",
        streak_count: 3,
        longest_streak: 5,
        last_review_date: todayUtc(),
        timezone: "UTC",
      });

      const result = await progressTable.streak.query();

      expect(result).toEqual({
        streakCount: 3,
        longestStreak: 5,
        reviewedToday: true,
      });
    });

    it("resets streak to 0 when a gap day had due cards", async () => {
      await testDb.drizzleDb.insert(userStats).values({
        id: "stats-1",
        streak_count: 6,
        longest_streak: 9,
        last_review_date: daysAgoUtc(5),
        timezone: "UTC",
      });
      // A card due 3 days ago falls inside the gap (lastReview+1 .. today-1).
      await insertFlashcard(testDb, {
        due_timestamp_ms: Date.now() - 3 * DAY_MS,
      });

      const result = await progressTable.streak.query();

      expect(result.streakCount).toBe(0);
      expect(result.longestStreak).toBe(9);
      expect(result.reviewedToday).toBe(false);

      // Persisted: a second read still sees 0.
      const [row] = await testDb.drizzleDb.select().from(userStats);
      expect(row.streak_count).toBe(0);
    });
  });

  describe("recordReview", () => {
    it("creates a fresh streak row when none exists", async () => {
      await progressTable.recordReview.mutation();

      const [row] = await testDb.drizzleDb.select().from(userStats);
      expect(row.streak_count).toBe(1);
      expect(row.longest_streak).toBe(1);
    });

    it("is a no-op when already reviewed today", async () => {
      await testDb.drizzleDb.insert(userStats).values({
        id: "stats-1",
        streak_count: 4,
        longest_streak: 4,
        last_review_date: todayUtc(),
        timezone: "UTC",
      });

      await progressTable.recordReview.mutation();

      const [row] = await testDb.drizzleDb.select().from(userStats);
      expect(row.streak_count).toBe(4);
    });

    it("increments the streak when the last review was yesterday", async () => {
      await testDb.drizzleDb.insert(userStats).values({
        id: "stats-1",
        streak_count: 4,
        longest_streak: 4,
        last_review_date: yesterdayUtc(),
        timezone: "UTC",
      });

      await progressTable.recordReview.mutation();

      const [row] = await testDb.drizzleDb.select().from(userStats);
      expect(row.streak_count).toBe(5);
      expect(row.longest_streak).toBe(5);
      expect(row.last_review_date).toBe(todayUtc());
    });
  });
});
