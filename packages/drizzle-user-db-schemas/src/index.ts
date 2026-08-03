/**
 * @file User database schemas for Bahar application.
 * These schemas are used on the client side with Turso WASM + Drizzle ORM.
 */

export {
  buildDefaultCardLayout,
  CARD_FACES,
  CARD_FIELD_IDS,
  type CardFace,
  type CardFieldId,
  type CardLayout,
  CardLayoutSchema,
  hiddenCardFields,
  REQUIRED_FIELD_BY_FACE,
  resolveCardFace,
} from "./card-layout";

export { decks, type InsertDeck, type RawDeck, type SelectDeck } from "./decks";

export {
  dictionaryEntries,
  type InsertDictionaryEntry,
  InsertDictionaryEntrySchema,
  type RawDictionaryEntry,
  type SelectDictionaryEntry,
  SelectDictionaryEntrySchema,
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
export {
  type InsertUserStats,
  type SelectUserStats,
  userStats,
} from "./user-stats";
