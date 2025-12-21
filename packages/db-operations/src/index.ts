/**
 * @bahar/db-operations - Shared database operations utilities
 *
 * Provides cross-platform database utilities for web and mobile apps.
 */

export {
  type DatabaseAdapter,
  type DatabaseAdapterFactory,
  type PreparedStatement,
} from "./adapter";

// SQL utilities
export {
  buildSelectWithNestedJson,
  buildInClause,
  buildSetClause,
  generateId,
} from "./utils";

export {
  DICTIONARY_ENTRY_COLUMNS,
  FLASHCARD_LIMIT,
  BATCH_SIZE,
} from "./constants";

export {
  safeJsonParse,
  convertRawDictionaryEntryToSelect,
  nullToUndefined,
  type ConvertDictionaryEntryError,
} from "./converters";

export { type TableOperation } from "./types";
