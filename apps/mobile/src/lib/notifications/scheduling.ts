/**
 * Pure coalescing logic for review reminders, split out from the
 * expo-notifications side effects in ./index so it can be unit-tested in
 * isolation (no native modules, DB, or store imports).
 */

/**
 * Coalescing knobs. Cards whose due times fall in the same BUCKET collapse into
 * one reminder; consecutive reminders are spaced at least MIN_GAP apart; at most
 * MAX_REMINDERS are scheduled ahead (also keeps us well under iOS's 64-pending
 * cap). Together these stop a staggered review -- many cards graded seconds
 * apart, all due ~15 min later -- from firing a burst of notifications.
 */
export const BUCKET_MS = 30 * 60 * 1000;
export const MIN_GAP_MS = 2 * 60 * 60 * 1000;
export const MAX_REMINDERS = 3;
export const MIN_LEAD_MS = 60 * 1000;

export interface ReviewReminder {
  fireAt: number;
  count: number;
}

/**
 * Given upcoming due timestamps and `now`, returns the reminders to schedule:
 * bucketed by BUCKET_MS, spaced by MIN_GAP_MS, capped at MAX_REMINDERS. Each
 * reminder's `count` is cumulative -- the number of cards due by its fire time,
 * including cards from buckets merged away by the gap rule -- so the "N cards
 * ready" text is never an undercount.
 */
export const computeReminders = (
  dueTimestamps: number[],
  now: number
): ReviewReminder[] => {
  const future = dueTimestamps
    .filter((timestamp) => timestamp > now)
    .sort((a, b) => a - b);

  if (future.length === 0) return [];

  // bucketKey -> { count, earliest due time in the bucket }
  const buckets = new Map<number, { count: number; earliest: number }>();
  for (const timestamp of future) {
    const key = Math.floor(timestamp / BUCKET_MS);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
    } else {
      // `future` is sorted, so the first timestamp seen for a key is its earliest.
      buckets.set(key, { count: 1, earliest: timestamp });
    }
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);

  const reminders: ReviewReminder[] = [];
  let cumulativeCount = 0;
  let lastFireAt = Number.NEGATIVE_INFINITY;

  for (const key of sortedKeys) {
    const bucket = buckets.get(key);
    if (!bucket) continue;

    cumulativeCount += bucket.count;

    // Fire when the earliest card in the bucket is actually due (clamped so it's
    // never in the past / too immediate).
    const fireAt = Math.max(bucket.earliest, now + MIN_LEAD_MS);

    // Merge buckets closer than MIN_GAP: skip scheduling this one, but its cards
    // stay in cumulativeCount so the next kept reminder reflects them.
    if (fireAt - lastFireAt < MIN_GAP_MS) continue;

    reminders.push({ fireAt, count: cumulativeCount });
    lastFireAt = fireAt;

    if (reminders.length >= MAX_REMINDERS) break;
  }

  return reminders;
};
