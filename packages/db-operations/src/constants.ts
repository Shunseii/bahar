/**
 * Shared constants for database operations.
 */

import type {
  SelectDictionaryEntry,
  TagMode,
} from "@bahar/drizzle-user-db-schemas";

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

/**
 * Tag combination used by deck and flashcard queries when a deck's filters
 * don't specify one.
 *
 * `"any"` because that is what these queries have always done -- the tag
 * subquery matches an entry carrying any one of the deck's tags. Defaulting to
 * `"all"` here would silently shrink every existing multi-tag deck, so decks
 * saved before `tagMode` existed keep their current contents and only an
 * explicit user choice changes them.
 */
export const DEFAULT_DECK_TAG_MODE: TagMode = "any";
