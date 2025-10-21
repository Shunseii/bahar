import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import {
  type RootLetters,
  type Tags,
  type Antonym,
  type Example,
  type Morphology,
  WORD_TYPES,
} from "./types";

/**
 * Dictionary entries table for user database.
 * Stores Arabic words/expressions with their translations and morphological information.
 */
export const dictionaryEntries = sqliteTable("dictionary_entries", {
  id: text("id").primaryKey().notNull(),
  created_at: text("created_at"),
  created_at_timestamp_ms: integer("created_at_timestamp_ms"),
  updated_at: text("updated_at"),
  updated_at_timestamp_ms: integer("updated_at_timestamp_ms"),
  word: text("word").notNull(),
  translation: text("translation").notNull(),
  definition: text("definition"),
  type: text("type", { enum: WORD_TYPES }).notNull(),
  root: text("root", { mode: "json" }).$type<RootLetters>(),
  tags: text("tags", { mode: "json" }).$type<Tags>(),
  antonyms: text("antonyms", { mode: "json" }).$type<Antonym[]>(),
  examples: text("examples", { mode: "json" }).$type<Example[]>(),
  morphology: text("morphology", { mode: "json" }).$type<Morphology>(),
});

export type SelectDictionaryEntry = typeof dictionaryEntries.$inferSelect;
export type InsertDictionaryEntry = typeof dictionaryEntries.$inferInsert;

/**
 * Represents the object shape before the json fields
 * have been transformed into their respective types.
 */
export type RawDictionaryEntry = Omit<
  SelectDictionaryEntry,
  "root" | "tags" | "antonyms" | "examples" | "morphology"
> & {
  root: string | null;
  tags: string | null;
  antonyms: string | null;
  examples: string | null;
  morphology: string | null;
};
