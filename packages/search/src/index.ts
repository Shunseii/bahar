/**
 * @bahar/search - Shared Orama search utilities
 *
 * Provides Arabic-aware search functionality using Orama for both
 * web and mobile apps.
 */

// Arabic text utilities
export {
  stripArabicDiacritics,
  normalizeArabicHamza,
  normalizeArabicWeakLetters,
  normalizeArabicForSearch,
  isArabicText,
  detectLanguage,
} from "./arabic";

// Tokenizer
export {
  arabicTokenizer,
  englishTokenizer,
  multiLanguageTokenizer,
  type OramaLanguage,
} from "./tokenizer";

// Highlighting
export { highlightWithDiacritics } from "./highlight";

// Schema and types
export {
  dictionarySchema,
  type DictionaryDocument,
  type DictionaryOrama,
} from "./schema";

// Database operations
export {
  createDictionaryDatabase,
  insertDocuments,
  insertDocument,
  updateDocument,
  removeDocument,
  searchDictionary,
  insert,
  update,
  remove,
  search,
  insertMultiple,
} from "./database";
