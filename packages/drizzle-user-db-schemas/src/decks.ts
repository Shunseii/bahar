import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { DeckFilters } from "./types";

/**
 * Decks table for user database.
 * Stores study deck configurations with filters for flashcard selection.
 */
export const decks = sqliteTable("decks", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  filters: text("filters", { mode: "json" }).$type<DeckFilters>(),
});

export type SelectDeck = typeof decks.$inferSelect;
export type InsertDeck = typeof decks.$inferInsert;

export type RawDeck = Omit<SelectDeck, "filters"> & {
  filters: string | null;
};
