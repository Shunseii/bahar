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
  // Field name ≠ column name on purpose: renaming a synced column silently
  // reverts (see BAH-161). Repurposed too -- was a query-time gate ("show
  // reverse cards in study"), now a create-time default ("new words get a
  // reverse card"). Reverse existence is per-word row presence, not this flag.
  create_reverse_by_default: integer("show_reverse_flashcards", {
    mode: "boolean",
  }).default(false),
});

export type SelectSetting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

export type RawSetting = Omit<SelectSetting, "create_reverse_by_default"> & {
  create_reverse_by_default: number;
};
