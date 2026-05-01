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

const getDeviceTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const resolveTimezone = (stored: string | null | undefined): string =>
  stored && isValidTimezone(stored) ? stored : getDeviceTimezone();

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateString = (s: string | null | undefined): s is string =>
  !!s && ISO_DATE_RE.test(s);

// Build the ISO date string manually via formatToParts so the output is the
// same on Hermes (mobile) and V8 (web). `toLocaleDateString("en-CA", ...)` is
// honored by V8 but ignored by RN Hermes, which falls back to the device
// locale (e.g. "M/D/YYYY" on US devices).
const formatDateInTz = ({
  date,
  timezone,
}: {
  date: Date;
  timezone: string;
}) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const getToday = (timezone: string) =>
  formatDateInTz({ date: new Date(), timezone });

const getYesterday = (timezone: string) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return formatDateInTz({ date: oneDayAgo, timezone });
};

const hasDueCardsInGap = async ({
  drizzleDb,
  lastReviewDate,
  today,
}: {
  drizzleDb: ReturnType<typeof getDrizzleDb>;
  lastReviewDate: string;
  today: string;
}): Promise<boolean> => {
  const [yStart, mStart, dStart] = lastReviewDate.split("-").map(Number);
  const [yEnd, mEnd, dEnd] = today.split("-").map(Number);
  const gapStart = new Date(yStart, mStart - 1, dStart);
  gapStart.setDate(gapStart.getDate() + 1);
  const gapEnd = new Date(yEnd, mEnd - 1, dEnd);
  gapEnd.setDate(gapEnd.getDate() - 1);
  if (gapEnd < gapStart) return false;

  const startMs = startOfDay(gapStart).getTime();
  const endMs = endOfDay(gapEnd).getTime();

  const [result] = await drizzleDb
    .select({ c: count() })
    .from(flashcards)
    .where(
      and(
        gte(flashcards.due_timestamp_ms, startMs),
        lte(flashcards.due_timestamp_ms, endMs),
        eq(flashcards.is_hidden, false)
      )
    );
  return (result?.c ?? 0) > 0;
};

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

      const [row] = (await drizzleDb
        .select()
        .from(userStats)
        .limit(1)) as SelectUserStats[];

      if (!row) {
        return { streakCount: 0, longestStreak: 0, reviewedToday: false };
      }

      const timezone = resolveTimezone(row.timezone);
      if (row.timezone !== timezone) {
        await drizzleDb
          .update(userStats)
          .set({ timezone })
          .where(eq(userStats.id, row.id));
      }

      const today = getToday(timezone);
      const yesterday = getYesterday(timezone);
      const lastReview = isValidDateString(row.last_review_date)
        ? row.last_review_date
        : null;
      const reviewedToday = lastReview === today;

      if (lastReview && lastReview < yesterday) {
        const hadDueInGap = await hasDueCardsInGap({
          drizzleDb,
          lastReviewDate: lastReview,
          today,
        });

        if (hadDueInGap) {
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

      const [row] = (await drizzleDb
        .select()
        .from(userStats)
        .limit(1)) as SelectUserStats[];

      if (!row) {
        const timezone = getDeviceTimezone();
        await drizzleDb.insert(userStats).values({
          id: nanoid(),
          streak_count: 1,
          longest_streak: 1,
          last_review_date: getToday(timezone),
          timezone,
        });
        return;
      }

      const timezone = resolveTimezone(row.timezone);
      const today = getToday(timezone);
      const yesterday = getYesterday(timezone);
      const lastReview = isValidDateString(row.last_review_date)
        ? row.last_review_date
        : null;

      if (lastReview === today) {
        if (row.timezone !== timezone) {
          await drizzleDb
            .update(userStats)
            .set({ timezone })
            .where(eq(userStats.id, row.id));
        }
        return;
      }

      const currentStreak = row.streak_count ?? 0;
      const longestStreak = row.longest_streak ?? 0;

      let newStreak: number;
      if (lastReview === yesterday) {
        newStreak = currentStreak + 1;
      } else if (lastReview && lastReview < yesterday) {
        const hadDueInGap = await hasDueCardsInGap({
          drizzleDb,
          lastReviewDate: lastReview,
          today,
        });
        newStreak = hadDueInGap ? 1 : currentStreak + 1;
      } else if (lastReview === null && currentStreak > 0) {
        // Streak exists but last_review_date is missing or unparseable
        // — give the user the benefit of the doubt and continue.
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
          ...(row.timezone === timezone ? {} : { timezone }),
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
