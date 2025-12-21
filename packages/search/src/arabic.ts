/**
 * Arabic text normalization utilities for search
 */

/**
 * Removes Arabic diacritical marks (Tashkeel) and Tatweel from text.
 * Example: "كِتَابٌ" → "كتاب"
 */
export const stripArabicDiacritics = (text: string): string => {
  return text.replace(/[\u064B-\u0652\u0640]/g, "");
};

/**
 * Normalizes hamza variants (أ إ آ ء ؤ ئ) to bare alif (ا)
 * Example: "هيئة" → "هيائ" , "مسؤول" → "مساوول"
 */
export const normalizeArabicHamza = (text: string): string => {
  return text.replace(/[أإآءؤئ]/g, "ا");
};

/**
 * Normalizes weak letters (حروف العلة: ا و ي) to alif (ا)
 * Example: "عمارة" → "عاااة", "كتوب" → "كتاب"
 */
export const normalizeArabicWeakLetters = (text: string): string => {
  return text.replace(/[اوي]/g, "ا");
};

/**
 * Applies all Arabic normalization transformations for search matching.
 * Combines: diacritics removal + hamza normalization + weak letter normalization
 */
export const normalizeArabicForSearch = (text: string): string => {
  return normalizeArabicWeakLetters(
    normalizeArabicHamza(stripArabicDiacritics(text)),
  );
};

/**
 * Detects whether the input text is primarily Arabic.
 */
export const isArabicText = (text: string): boolean => {
  const cleanedText = text.replace(/[\s.,!?;:'"()[\]{}،؛]/g, "");
  if (cleanedText.length === 0) return false;

  const arabicRegex =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const arabicMatches = cleanedText.match(arabicRegex);
  const arabicCount = arabicMatches ? arabicMatches.length : 0;

  const englishRegex = /[a-zA-Z]/g;
  const englishMatches = cleanedText.match(englishRegex);
  const englishCount = englishMatches ? englishMatches.length : 0;

  return arabicCount > englishCount;
};

/**
 * Detects the primary language of text.
 * @returns "ar" for Arabic, "en" for English, "unknown" otherwise
 */
export const detectLanguage = (text: string): "ar" | "en" | "unknown" => {
  const cleanedText = text.replace(/[\s.,!?;:'"()[\]{}،؛]/g, "");
  if (cleanedText.length === 0) return "unknown";

  const arabicRegex =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const arabicMatches = cleanedText.match(arabicRegex);
  const arabicCount = arabicMatches ? arabicMatches.length : 0;

  const englishRegex = /[a-zA-Z]/g;
  const englishMatches = cleanedText.match(englishRegex);
  const englishCount = englishMatches ? englishMatches.length : 0;

  if (arabicCount > englishCount) return "ar";
  if (englishCount > arabicCount) return "en";
  return "unknown";
};
