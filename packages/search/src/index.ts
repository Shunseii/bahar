/**
 * @bahar/search - Shared Orama search utilities
 *
 * Provides Arabic-aware search functionality using Orama for both
 * web and mobile apps.
 */

export {
  detectLanguage,
  isArabicText,
  normalizeArabicForSearch,
  normalizeArabicHamza,
  normalizeArabicWeakLetters,
  stripArabicDiacritics,
} from "./arabic";
export {
  createDictionaryDatabase,
  insert,
  insertDocument,
  insertDocuments,
  insertMultiple,
  remove,
  removeDocument,
  search,
  searchDictionary,
  update,
  updateDocument,
} from "./database";

export { highlightWithDiacritics } from "./highlight";

export {
  type DictionaryDocument,
  type DictionaryOrama,
  dictionarySchema,
} from "./schema";
export {
  arabicTokenizer,
  englishTokenizer,
  multiLanguageTokenizer,
  type OramaLanguage,
} from "./tokenizer";
