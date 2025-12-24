/**
 * Multi-language tokenizer for Orama search
 */

import { tokenizer as defaultTokenizer } from "@orama/orama/components";
import { stemmer as arabicStemmer } from "@orama/stemmers/arabic";
import { normalizeArabicForSearch } from "./arabic";

export type OramaLanguage = "arabic" | "english";

/**
 * Arabic tokenizer with stemming and normalization
 */
export const arabicTokenizer = defaultTokenizer.createTokenizer({
  language: "arabic",
  stemming: true,
  stemmer: arabicStemmer,
  // Disabling stop words because words are added by users manually
  stopWords: false,
  stemmerSkipProperties: ["tags"],
});

/**
 * English tokenizer with stemming
 */
export const englishTokenizer = defaultTokenizer.createTokenizer({
  language: "english",
  stemming: true,
  stopWords: false,
  stemmerSkipProperties: ["tags"],
});

/**
 * Properties that should use English tokenization
 */
const ENGLISH_PROPS = ["translation"];

/**
 * Multi-language tokenizer that delegates to Arabic or English tokenizers
 * based on the property name and language parameter
 */
export const multiLanguageTokenizer = {
  language: "multi" as const,
  normalizationCache: new Map<string, string>(),

  tokenize(raw: string, language: string, prop?: string): string[] {
    const normalizedRaw = normalizeArabicForSearch(raw);

    if (prop && ENGLISH_PROPS.includes(prop)) {
      return englishTokenizer.tokenize(raw, "english", prop);
    }

    if (prop && !language && !ENGLISH_PROPS.includes(prop)) {
      return arabicTokenizer.tokenize(normalizedRaw, "arabic", prop);
    }

    if (language === "arabic") {
      return arabicTokenizer.tokenize(normalizedRaw, language, prop);
    }

    return englishTokenizer.tokenize(raw, language, prop);
  },
};
