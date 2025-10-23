import { TLocale } from "./i18n";

export const REGEXP_ONLY_EN_AR_DIGITS = "^[0-9٠-٩]+$";

export const convertArabicNumToEnglish = (arabicNumber: string) => {
  const arabicNumerals = "٠١٢٣٤٥٦٧٨٩";
  const englishNumerals = "0123456789";

  const arabicToEnglishMap = new Map(
    [...arabicNumerals].map((num, index) => [num, englishNumerals[index]]),
  );

  const englishNumber = arabicNumber.replace(
    /[٠-٩]/g,
    (match) => arabicToEnglishMap.get(match) as string,
  );

  return englishNumber;
};

export const TRACE_ID_HEADER = "x-request-id";

export const generateTraceId = () => {
  return crypto.randomUUID();
};

/**
 * Detects whether the input text is primarily Arabic or English.
 * @param text - The text to analyze
 * @returns "ar" if the text contains more Arabic characters,
 *          "en" if it contains more English characters,
 *          "unknown" if it contains neither or equal amounts
 */
export const detectLanguage = (text: string): TLocale | "unknown" => {
  // Remove whitespace and punctuation for analysis
  const cleanedText = text.replace(/[\s.,!?;:'"()[\]{}،؛]/g, "");

  if (cleanedText.length === 0) {
    return "unknown";
  }

  // Count Arabic characters (includes all Arabic Unicode ranges)
  const arabicRegex =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const arabicMatches = cleanedText.match(arabicRegex);
  const arabicCount = arabicMatches ? arabicMatches.length : 0;

  const englishRegex = /[a-zA-Z]/g;
  const englishMatches = cleanedText.match(englishRegex);
  const englishCount = englishMatches ? englishMatches.length : 0;

  if (arabicCount > englishCount) {
    return "ar";
  } else if (englishCount > arabicCount) {
    return "en";
  } else if (arabicCount === 0 && englishCount === 0) {
    return "unknown";
  } else {
    return "unknown";
  }
};

export const stripArabicDiacritics = (text: string): string => {
  // Remove Arabic diacritical marks (Tashkeel) and Tatweel
  return text.replace(/[\u064B-\u0652\u0640]/g, "");
};
