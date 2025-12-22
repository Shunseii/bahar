/**
 * @bahar/search - Shared Orama search utilities
 *
 * Provides Arabic-aware search functionality using Orama for both
 * web and mobile apps.
 */

export {
  stripArabicDiacritics,
  normalizeArabicHamza,
  normalizeArabicWeakLetters,
  normalizeArabicForSearch,
  isArabicText,
  detectLanguage,
} from "./arabic";

export {
  arabicTokenizer,
  englishTokenizer,
  multiLanguageTokenizer,
  type OramaLanguage,
} from "./tokenizer";

export { highlightWithDiacritics } from "./highlight";

export {
  dictionarySchema,
  type DictionaryDocument,
  type DictionaryOrama,
} from "./schema";

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
