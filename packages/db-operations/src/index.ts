/**
 * @bahar/db-operations - Shared database operations utilities
 *
 * Provides cross-platform database utilities for web and mobile apps.
 */

export type {
  DatabaseAdapter,
  DatabaseAdapterFactory,
  PreparedStatement,
} from "./adapter";

export {
  BATCH_SIZE,
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  DICTIONARY_ENTRY_COLUMNS,
  FLASHCARD_LIMIT,
} from "./constants";
export {
  type ConvertDictionaryEntryError,
  convertRawDictionaryEntryToSelect,
  nullToUndefined,
  safeJsonParse,
} from "./converters";
export { type DeckWithCounts, makeDecksTable } from "./operations/decks";
export type { DrizzleDb, OperationDeps } from "./operations/deps";
export { makeDictionaryEntriesTable } from "./operations/dictionary-entries";
export {
  type ClearBacklogRevlogEntry,
  type FlashcardQueue,
  type FlashcardWithDictionaryEntry,
  makeFlashcardsTable,
} from "./operations/flashcards";
export { makeMigrationTable } from "./operations/migration";
export { makeProgressTable } from "./operations/progress";
export { makeSettingsTable } from "./operations/settings";
export {
  configureDbQueue,
  enqueueDbOperation,
  enqueueSyncOperation,
  hasPendingOperations,
} from "./queue";
export type { NullToUndefined, TableOperation } from "./types";

// SQL utilities
export {
  buildInClause,
  buildSelectWithNestedJson,
  buildSetClause,
  generateId,
} from "./utils";
