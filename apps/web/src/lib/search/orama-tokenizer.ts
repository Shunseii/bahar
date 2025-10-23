import { tokenizer as defaultTokenizer } from "@orama/orama/components";
import { stopwords as arabicStopwords } from "@orama/stopwords/arabic";
import { stopwords as englishStopwords } from "@orama/stopwords/english";
import { stemmer as arabicStemmer } from "@orama/stemmers/arabic";
import { stripArabicDiacritics } from "../utils";

export type OramaLanguage = "arabic" | "english";

export const arabicTokenizer = defaultTokenizer.createTokenizer({
  language: "arabic",
  stemming: true,
  stemmer: arabicStemmer,
  stopWords: arabicStopwords,
});

const englishTokenizer = defaultTokenizer.createTokenizer({
  language: "english",
  stemming: true,
  stopWords: englishStopwords,
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

    const cleanedRaw = stripArabicDiacritics(raw);

    let result: string[];

    if (prop && ENGLISH_PROPS.includes(prop)) {
      result = englishTokenizer.tokenize(raw, "english", prop);
    } else if (prop && !language && !ENGLISH_PROPS.includes(prop)) {
      result = arabicTokenizer.tokenize(cleanedRaw, "arabic", prop);
    } else if (language === "arabic") {
      result = arabicTokenizer.tokenize(cleanedRaw, language, prop);
    } else {
      result = englishTokenizer.tokenize(raw, language, prop);
    }

    return result;
  },
};
