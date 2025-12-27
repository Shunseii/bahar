/**
 * @file User database schemas for Bahar application.
 * These schemas are used on the client side with Turso WASM + Drizzle ORM.
 */

export { decks, type InsertDeck, type RawDeck, type SelectDeck } from "./decks";

export {
  dictionaryEntries,
  type InsertDictionaryEntry,
  type RawDictionaryEntry,
  type SelectDictionaryEntry,
} from "./dictionary";

export {
  flashcards,
  type InsertFlashcard,
  type RawFlashcard,
  type SelectFlashcard,
} from "./flashcards";

export {
  type InsertMigration,
  migrations,
  type SelectMigration,
} from "./migrations";

export {
  type InsertSetting,
  type RawSetting,
  type SelectSetting,
  settings,
} from "./settings";

export * from "./types";
