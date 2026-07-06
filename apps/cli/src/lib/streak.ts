/**
 * Daily-streak update run after a flashcard grade.
 *
 * Copied from apps/mobile/src/lib/db/operations/progress.ts (`recordReview`)
 * so the CLI keeps the streak consistent with the app. This is a deliberate
 * third copy — see BAH-153 for extracting it into a shared package.
 */

import { generateId } from "@bahar/db-operations";
import {
  flashcards,
  type SelectUserStats,
  userStats,
} from "@bahar/drizzle-user-db-schemas";
import { endOfDay, startOfDay } from "date-fns";
import { and, count, eq, gte, lte } from "drizzle-orm";
import type { UserDb } from "./db";

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
  db,
  lastReviewDate,
  today,
}: {
  db: UserDb;
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

  const [result] = await db
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

/**
 * Records that a review happened today and advances the streak.
 */
export const recordReview = async (db: UserDb): Promise<void> => {
  const [row] = (await db
    .select()
    .from(userStats)
    .limit(1)) as SelectUserStats[];

  if (!row) {
    const timezone = getDeviceTimezone();
    await db.insert(userStats).values({
      id: generateId(),
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
      await db
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
      db,
      lastReviewDate: lastReview,
      today,
    });
    newStreak = hadDueInGap ? 1 : currentStreak + 1;
  } else if (lastReview === null && currentStreak > 0) {
    newStreak = currentStreak + 1;
  } else {
    newStreak = 1;
  }

  const newLongest = Math.max(longestStreak, newStreak);

  await db
    .update(userStats)
    .set({
      streak_count: newStreak,
      longest_streak: newLongest,
      last_review_date: today,
      ...(row.timezone === timezone ? {} : { timezone }),
    })
    .where(eq(userStats.id, row.id));
};
