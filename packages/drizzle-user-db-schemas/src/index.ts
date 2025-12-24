/**
 * @file User database schemas for Bahar application.
 * These schemas are used on the client side with Turso WASM + Drizzle ORM.
 */

// Export all types
export * from "./types";

// Export dictionary schema and types
export {
  dictionaryEntries,
  type SelectDictionaryEntry,
  type InsertDictionaryEntry,
  type RawDictionaryEntry,
} from "./dictionary";

// Export flashcards schema and types
export {
  flashcards,
  type SelectFlashcard,
  type InsertFlashcard,
  type RawFlashcard,
} from "./flashcards";

// Export decks schema and types
export { decks, type SelectDeck, type InsertDeck, type RawDeck } from "./decks";

// Export settings schema and types
export {
  settings,
  type SelectSetting,
  type InsertSetting,
  type RawSetting,
} from "./settings";

// Export migrations schema and types
export {
  migrations,
  type SelectMigration,
  type InsertMigration,
} from "./migrations";
