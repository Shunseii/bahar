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
 * Arabic tokenizer for exact fields - no stemming, only diacritic stripping.
 * This preserves hamza variants and weak letters for exact matching.
 */
export const arabicExactTokenizer = defaultTokenizer.createTokenizer({
  language: "arabic",
  stemming: false,
  stopWords: false,
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

const DEFINITE_ARTICLE_PREFIX = /^(وال|بال|كال|فال|لل|ال)/;

/**
 * Removes a leading definite article (with an attached و/ب/ك/ف/ل) unless that
 * would leave fewer than two letters, e.g. "البيان" → "بيان".
 */
export const stripDefiniteArticle = (word: string): string => {
  const stripped = word.replace(DEFINITE_ARTICLE_PREFIX, "");
  return stripped.length >= 2 ? stripped : word;
};

/**
 * The Arabic stemmer strips root letters as affixes (بيان → يان, البيان → الب),
 * so a stem alone often fails to match the same word with ال. Indexing the
 * unstemmed word and its article-less form alongside the stems keeps those
 * matches, and an exact word then matches more tokens and ranks higher.
 */
const withSurfaceForms = ({
  stems,
  normalizedRaw,
  prop,
}: {
  stems: string[];
  normalizedRaw: string;
  prop?: string;
}): string[] => {
  const words = arabicExactTokenizer.tokenize(normalizedRaw, "arabic", prop);
  const surfaceForms = words.flatMap((word) => {
    const bare = stripDefiniteArticle(word);
    return [word, bare, ...arabicTokenizer.tokenize(bare, "arabic", prop)];
  });
  return [...new Set([...stems, ...surfaceForms])];
};

/**
 * Properties that should use English tokenization
 */
const ENGLISH_PROPS = ["translation"];

/**
 * Multi-language tokenizer that delegates to Arabic or English tokenizers
 * based on the property name and language parameter.
 *
 * For `*_exact` fields, uses minimal normalization (diacritics only) to enable
 * exact matching that ranks higher than fuzzy/normalized matches.
 */
export const multiLanguageTokenizer = {
  language: "multi" as const,
  normalizationCache: new Map<string, string>(),

  tokenize(raw: string, language: string, prop?: string): string[] {
    if (prop && ENGLISH_PROPS.includes(prop)) {
      return englishTokenizer.tokenize(raw, "english", prop);
    }

    const normalizedRaw = normalizeArabicForSearch(raw);

    if (prop && !language && !ENGLISH_PROPS.includes(prop)) {
      return withSurfaceForms({
        stems: arabicTokenizer.tokenize(normalizedRaw, "arabic", prop),
        normalizedRaw,
        prop,
      });
    }

    if (language === "arabic") {
      return withSurfaceForms({
        stems: arabicTokenizer.tokenize(normalizedRaw, language, prop),
        normalizedRaw,
        prop,
      });
    }

    return englishTokenizer.tokenize(raw, language, prop);
  },
};
