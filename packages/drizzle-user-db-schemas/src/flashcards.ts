import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { dictionaryEntries } from "./dictionary";
import { FLASHCARD_DIRECTIONS } from "./types";

/**
 * Flashcards table for user database.
 * Uses FSRS (Free Spaced Repetition Scheduler) algorithm for scheduling reviews.
 * Each dictionary entry can have up to 2 flashcards (forward and reverse).
 */
export const flashcards = sqliteTable(
  "flashcards",
  {
    id: text("id").primaryKey().notNull(),
    dictionary_entry_id: text("dictionary_entry_id")
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: "cascade" }),

    // FSRS scheduling fields
    difficulty: real("difficulty").default(0),
    due: text("due").notNull(),
    due_timestamp_ms: integer("due_timestamp_ms").notNull(),
    elapsed_days: integer("elapsed_days").default(0),
    lapses: integer("lapses").default(0),
    last_review: text("last_review"),
    last_review_timestamp_ms: integer("last_review_timestamp_ms"),
    reps: integer("reps").default(0),
    scheduled_days: integer("scheduled_days").default(0),
    stability: real("stability").default(0),
    state: integer("state").default(0),

    // Flashcard configuration
    direction: text("direction", { enum: FLASHCARD_DIRECTIONS })
      .notNull()
      .default("forward"),
    is_hidden: integer("is_hidden", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => ({
    // Unique constraint: each dictionary entry can have at most one flashcard per direction
    entryDirectionIdx: uniqueIndex("flashcards_entry_direction_unique").on(
      table.dictionary_entry_id,
      table.direction,
    ),
  }),
);

export type SelectFlashcard = typeof flashcards.$inferSelect;
export type InsertFlashcard = typeof flashcards.$inferInsert;
