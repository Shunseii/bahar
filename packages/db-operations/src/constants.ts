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
 * Batch size for bulk operations.
 */
export const BATCH_SIZE = 500;
