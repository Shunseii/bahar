/**
 * Arabic-aware text highlighting for search results
 */

import { normalizeArabicForSearch } from "./arabic";

/** Regex for Arabic diacritics (harakat) and tatweel */
const DIACRITICS_REGEX = /[\u064B-\u0652\u0640]/;

interface HighlightOptions {
  HTMLTag?: string;
  CSSClass?: string;
}

/**
 * Creates a mapping from normalized text positions to original text positions.
 * Only diacritics are skipped (not counted as positions).
 */
const buildPositionMap = (original: string): number[] => {
  const map: number[] = [];

  for (let i = 0; i < original.length; i++) {
    if (!DIACRITICS_REGEX.test(original[i])) {
      map.push(i);
    }
  }

  return map;
};

/**
 * Maps normalized-text match positions back to original-text positions,
 * including any trailing diacritics.
 */
const mapToOriginalPositions = (
  matches: Array<{ start: number; end: number }>,
  positionMap: number[],
  originalText: string
): Array<{ start: number; end: number }> => {
  return matches.map(({ start, end }) => {
    const originalStart = positionMap[start];
    const lastCharOriginalPos = positionMap[end - 1];

    let originalEnd = lastCharOriginalPos + 1;
    while (
      originalEnd < originalText.length &&
      DIACRITICS_REGEX.test(originalText[originalEnd])
    ) {
      originalEnd++;
    }

    return { start: originalStart, end: originalEnd };
  });
};

/**
 * Finds highlight match positions in text using Arabic-aware normalization.
 * Returns an array of { start, end } positions in the original text.
 * This is the platform-agnostic core — use it to build highlighting
 * for any rendering target (HTML, React Native Text, etc.).
 */
export const findHighlightPositions = (
  text: string,
  searchTerm: string
): Array<{ start: number; end: number }> => {
  if (!searchTerm.trim()) return [];

  const normalizedText = normalizeArabicForSearch(text);
  const normalizedTerm = normalizeArabicForSearch(searchTerm);
  const positionMap = buildPositionMap(text);

  const regex = new RegExp(escapeRegExp(normalizedTerm), "gi");
  const matches: Array<{ start: number; end: number }> = [];

  for (
    let match = regex.exec(normalizedText);
    match !== null;
    match = regex.exec(normalizedText)
  ) {
    matches.push({ start: match.index, end: match.index + match[0].length });
  }

  if (matches.length === 0) return [];

  return mapToOriginalPositions(matches, positionMap, text);
};

/**
 * Escapes special regex characters in a string.
 */
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Highlights text matches with Arabic-aware normalization.
 * Mimics Meilisearch's behavior:
 * - Ignores diacritics (harakat): "كتاب" matches "كِتَابٌ"
 * - Normalizes hamza: "هيأة" matches "هيئة"
 * - Normalizes weak letters: "عميرة" matches "عمارة"
 */
export const highlightWithDiacritics = (
  text: string,
  searchTerm: string,
  options: HighlightOptions = {}
): string => {
  const { HTMLTag = "mark", CSSClass = "" } = options;

  if (!searchTerm.trim()) {
    return text;
  }

  const normalizedText = normalizeArabicForSearch(text);
  const normalizedTerm = normalizeArabicForSearch(searchTerm);
  const positionMap = buildPositionMap(text);

  // Find all matches in the normalized text (case-insensitive)
  const regex = new RegExp(escapeRegExp(normalizedTerm), "gi");
  const matches: Array<{ start: number; end: number }> = [];

  for (
    let match = regex.exec(normalizedText);
    match !== null;
    match = regex.exec(normalizedText)
  ) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  if (matches.length === 0) {
    return text;
  }

  // Map normalized positions back to original positions
  const originalMatches = mapToOriginalPositions(matches, positionMap, text);

  // Build the highlighted string
  const classAttr = CSSClass ? ` class="${CSSClass}"` : "";
  const openTag = `<${HTMLTag}${classAttr}>`;
  const closeTag = `</${HTMLTag}>`;

  let result = "";
  let lastEnd = 0;

  for (const { start, end } of originalMatches) {
    result += text.slice(lastEnd, start);
    result += openTag + text.slice(start, end) + closeTag;
    lastEnd = end;
  }

  result += text.slice(lastEnd);

  return result;
};
