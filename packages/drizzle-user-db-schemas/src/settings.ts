import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { ANTONYMS_MODES } from "./types";

/**
 * Settings table for user database.
 * Stores user preferences and configuration.
 */
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().notNull(),
  show_antonyms_in_flashcard: text("show_antonyms_in_flashcard", {
    enum: ANTONYMS_MODES,
  }).default("hidden"),
  show_reverse_flashcards: integer("show_reverse_flashcards", {
    mode: "boolean",
  }).default(false),
});

export type SelectSetting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

export type RawSetting = Omit<SelectSetting, "show_reverse_flashcards"> & {
  show_reverse_flashcards: number;
};
