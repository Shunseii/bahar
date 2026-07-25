/**
 * Shared constants for database operations.
 */

import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";

/**
 * All columns in the dictionary_entries table.
 */
export const DICTIONARY_ENTRY_COLUMNS = [
  "id",
  "created_at",
  "created_at_timestamp_ms",
  "updated_at",
  "updated_at_timestamp_ms",
  "word",
  "translation",
  "definition",
  "type",
  "root",
  "tags",
  "antonyms",
  "examples",
  "morphology",
] satisfies (keyof SelectDictionaryEntry)[];

/**
 * The threshold after which the UI won't display the exact number
 * of flashcards to review.
 */
export const FLASHCARD_LIMIT = 100;

/**
 * Default number of days after which a due card is considered part of the
 * backlog queue instead of the regular queue.
 */
export const DEFAULT_BACKLOG_THRESHOLD_DAYS = 7;

/**
 * Number of days the postpone operation spreads an overdue pile across,
 * starting with today. A default rather than a fixed policy -- the user picks
 * the window, and `clampPostponeWindow` bounds what they can pick.
 */
export const DEFAULT_POSTPONE_WINDOW_DAYS = 7;

export const MIN_POSTPONE_WINDOW_DAYS = 1;

/**
 * Longest window a user can spread a pile across. Past roughly a month this
 * stops being recovery and becomes avoidance, and pushing a card that far out
 * is a scheduling decision better served by resetting it outright.
 */
export const MAX_POSTPONE_WINDOW_DAYS = 30;

/**
 * Batch size for bulk operations.
 */
export const BATCH_SIZE = 500;
