import { tokenizer as defaultTokenizer } from "@orama/orama/components";
import { stemmer as arabicStemmer } from "@orama/stemmers/arabic";
import {
  stripArabicDiacritics,
  normalizeArabicHamza,
  normalizeArabicWeakLetters,
} from "../utils";

export type OramaLanguage = "arabic" | "english";

export const arabicTokenizer = defaultTokenizer.createTokenizer({
  language: "arabic",
  stemming: true,
  stemmer: arabicStemmer,

  // Disabling stop words because words are all added by
  // users manually, so each one is meaningful
  stopWords: false,
  stemmerSkipProperties: ["tags"],
});

const englishTokenizer = defaultTokenizer.createTokenizer({
  language: "english",
  stemming: true,
  stopWords: false,
  stemmerSkipProperties: ["tags"],
});

/**
 * Multi-language tokenizer that delegates to Arabic or English tokenizers
 * based on the language parameter
 */
export const multiLanguageTokenizer = {
  language: "multi" as const,
  normalizationCache: new Map<string, string>(),

  tokenize(raw: string, language: string, prop?: string): string[] {
    const ENGLISH_PROPS = ["translation"];

    const normalizedRaw = normalizeArabicWeakLetters(
      normalizeArabicHamza(stripArabicDiacritics(raw)),
    );

    let result: string[];

    if (prop && ENGLISH_PROPS.includes(prop)) {
      result = englishTokenizer.tokenize(raw, "english", prop);
    } else if (prop && !language && !ENGLISH_PROPS.includes(prop)) {
      result = arabicTokenizer.tokenize(normalizedRaw, "arabic", prop);
    } else if (language === "arabic") {
      result = arabicTokenizer.tokenize(normalizedRaw, language, prop);
    } else {
      result = englishTokenizer.tokenize(raw, language, prop);
    }

    return result;
  },
};
