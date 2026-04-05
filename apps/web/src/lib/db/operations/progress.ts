import {
  dictionaryEntries,
  FlashcardState,
  flashcards,
  type SelectUserStats,
  userStats,
} from "@bahar/drizzle-user-db-schemas";
import { addDays, endOfDay, startOfDay } from "date-fns";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lte,
  max,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { ensureDb, getDrizzleDb } from "..";
import type { TableOperation } from "./types";

function getToday() {
  return new Date().toLocaleDateString("en-CA");
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
}

export const progressTable = {
  wordsAdded: {
    query: async (): Promise<{ total: number; thisWeek: number }> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const [totalResult] = await drizzleDb
        .select({ total: count() })
        .from(dictionaryEntries);

      const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const [weeklyResult] = await drizzleDb
        .select({ weekly: count() })
        .from(dictionaryEntries)
        .where(gte(dictionaryEntries.created_at_timestamp_ms, weekAgoMs));

      return {
        total: totalResult?.total ?? 0,
        thisWeek: weeklyResult?.weekly ?? 0,
      };
    },
    cacheOptions: {
      queryKey: ["turso.progress.wordsAdded"] as const,
    },
  },
  wordsLearned: {
    query: async (): Promise<{
      learned: number;
      totalAdded: number;
      thisWeek: number;
    }> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const [learnedResult] = await drizzleDb
        .select({ learned: countDistinct(flashcards.dictionary_entry_id) })
        .from(flashcards)
        .where(
          and(
            eq(flashcards.state, FlashcardState.REVIEW),
            eq(flashcards.is_hidden, false)
          )
        );

      const [totalResult] = await drizzleDb
        .select({ total: count() })
        .from(dictionaryEntries);

      const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const [weeklyResult] = await drizzleDb
        .select({ weekly: countDistinct(flashcards.dictionary_entry_id) })
        .from(flashcards)
        .where(
          and(
            eq(flashcards.state, FlashcardState.REVIEW),
            eq(flashcards.is_hidden, false),
            gte(flashcards.last_review_timestamp_ms, weekAgoMs)
          )
        );

      return {
        learned: learnedResult?.learned ?? 0,
        totalAdded: totalResult?.total ?? 0,
        thisWeek: weeklyResult?.weekly ?? 0,
      };
    },
    cacheOptions: {
      queryKey: ["turso.progress.wordsLearned"] as const,
    },
  },
  difficultWords: {
    query: async (): Promise<{
      total: number;
      words: {
        word: string;
        translation: string;
        entryId: string;
        bothDirections: boolean;
      }[];
    }> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const words = await drizzleDb
        .select({
          entryId: flashcards.dictionary_entry_id,
          word: dictionaryEntries.word,
          translation: dictionaryEntries.translation,
          maxDifficulty: max(flashcards.difficulty).mapWith(Number),
          directionCount: countDistinct(flashcards.direction),
        })
        .from(flashcards)
        .innerJoin(
          dictionaryEntries,
          eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
        )
        .where(
          and(gt(flashcards.difficulty, 7), eq(flashcards.is_hidden, false))
        )
        .groupBy(flashcards.dictionary_entry_id)
        .orderBy(desc(max(flashcards.difficulty)))
        .limit(3);

      const [totalResult] = await drizzleDb
        .select({ total: countDistinct(flashcards.dictionary_entry_id) })
        .from(flashcards)
        .where(
          and(gt(flashcards.difficulty, 7), eq(flashcards.is_hidden, false))
        );

      return {
        total: totalResult?.total ?? 0,
        words: words.map((r) => ({
          word: r.word,
          translation: r.translation,
          entryId: r.entryId,
          bothDirections: r.directionCount > 1,
        })),
      };
    },
    cacheOptions: {
      queryKey: ["turso.progress.difficultWords"] as const,
    },
  },
  workloadForecast: {
    query: async ({
      showReverse,
      locale,
    }: {
      showReverse: boolean;
      locale: string;
    }): Promise<{
      days: { label: string; count: number }[];
      tomorrowCount: number;
    }> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const tomorrow = startOfDay(addDays(new Date(), 1));
      const directions: ("forward" | "reverse")[] = showReverse
        ? ["forward", "reverse"]
        : ["forward"];
      const dayFormatter = new Intl.DateTimeFormat(locale, {
        weekday: "short",
      });

      const days: { label: string; count: number }[] = [];

      for (let i = 0; i < 7; i++) {
        const dayStart = startOfDay(addDays(tomorrow, i));
        const dayEnd = endOfDay(addDays(tomorrow, i));

        const [result] = await drizzleDb
          .select({ count: count() })
          .from(flashcards)
          .where(
            and(
              gte(flashcards.due_timestamp_ms, dayStart.getTime()),
              lte(flashcards.due_timestamp_ms, dayEnd.getTime()),
              eq(flashcards.is_hidden, false),
              inArray(flashcards.direction, directions)
            )
          );

        days.push({
          label: dayFormatter.format(dayStart),
          count: Number(result?.count ?? 0),
        });
      }

      return {
        days,
        tomorrowCount: days[0]?.count ?? 0,
      };
    },
    cacheOptions: {
      queryKey: ["turso.progress.workloadForecast"] as const,
    },
  },
  streak: {
    query: async (): Promise<{
      streakCount: number;
      longestStreak: number;
      reviewedToday: boolean;
    }> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const [row] = await drizzleDb.select().from(userStats).limit(1);

      if (!row) {
        return { streakCount: 0, longestStreak: 0, reviewedToday: false };
      }

      const today = getToday();
      const yesterday = getYesterday();
      const lastReview = row.last_review_date;
      const reviewedToday = lastReview === today;

      // If streak is stale (last review before yesterday), it's broken
      if (lastReview && lastReview < yesterday) {
        // Update the DB to reflect the broken streak
        await drizzleDb
          .update(userStats)
          .set({ streak_count: 0 })
          .where(eq(userStats.id, row.id));

        return {
          streakCount: 0,
          longestStreak: row.longest_streak ?? 0,
          reviewedToday: false,
        };
      }

      return {
        streakCount: row.streak_count ?? 0,
        longestStreak: row.longest_streak ?? 0,
        reviewedToday,
      };
    },
    cacheOptions: {
      queryKey: ["turso.progress.streak"] as const,
    },
  },
  recordReview: {
    mutation: async (): Promise<void> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const today = getToday();
      const yesterday = getYesterday();

      const [row] = (await drizzleDb
        .select()
        .from(userStats)
        .limit(1)) as SelectUserStats[];

      if (!row) {
        await drizzleDb.insert(userStats).values({
          id: nanoid(),
          streak_count: 1,
          longest_streak: 1,
          last_review_date: today,
        });
        return;
      }

      if (row.last_review_date === today) return;

      const currentStreak = row.streak_count ?? 0;
      const longestStreak = row.longest_streak ?? 0;

      let newStreak: number;
      if (row.last_review_date === yesterday) {
        newStreak = currentStreak + 1;
      } else {
        newStreak = 1;
      }

      const newLongest = Math.max(longestStreak, newStreak);

      await drizzleDb
        .update(userStats)
        .set({
          streak_count: newStreak,
          longest_streak: newLongest,
          last_review_date: today,
        })
        .where(eq(userStats.id, row.id));
    },
    cacheOptions: {
      queryKey: ["turso.progress.recordReview"] as const,
    },
  },
  recentReviewWords: {
    query: async (
      entryIds: string[]
    ): Promise<Map<string, { word: string; translation: string }>> => {
      if (entryIds.length === 0) return new Map();

      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const rows = await drizzleDb
        .select({
          id: dictionaryEntries.id,
          word: dictionaryEntries.word,
          translation: dictionaryEntries.translation,
        })
        .from(dictionaryEntries)
        .where(inArray(dictionaryEntries.id, entryIds));

      return new Map(
        rows.map((r) => [r.id, { word: r.word, translation: r.translation }])
      );
    },
    cacheOptions: {
      queryKey: ["turso.progress.recentReviewWords"] as const,
    },
  },
} satisfies Record<string, TableOperation>;
