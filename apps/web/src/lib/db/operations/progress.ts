import {
  dictionaryEntries,
  FlashcardState,
  flashcards,
  type SelectUserStats,
  userStats,
} from "@bahar/drizzle-user-db-schemas";
import { and, count, countDistinct, eq, gte } from "drizzle-orm";
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
} satisfies Record<string, TableOperation>;
