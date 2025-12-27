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
  DICTIONARY_ENTRY_COLUMNS,
  FLASHCARD_LIMIT,
} from "./constants";

export {
  type ConvertDictionaryEntryError,
  convertRawDictionaryEntryToSelect,
  nullToUndefined,
  safeJsonParse,
} from "./converters";
export type { TableOperation } from "./types";

// SQL utilities
export {
  buildInClause,
  buildSelectWithNestedJson,
  buildSetClause,
  generateId,
} from "./utils";
