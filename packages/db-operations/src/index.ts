/**
 * @bahar/db-operations - Shared database operations utilities
 *
 * Provides cross-platform database utilities for web and mobile apps.
 */

// Database adapter interface
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

// Constants
export {
  DICTIONARY_ENTRY_COLUMNS,
  FLASHCARD_LIMIT,
  BATCH_SIZE,
} from "./constants";

// Data converters
export {
  safeJsonParse,
  convertRawDictionaryEntryToSelect,
  nullToUndefined,
  type ConvertDictionaryEntryError,
} from "./converters";

// Types
export { type TableOperation } from "./types";
