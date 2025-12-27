/**
 * Arabic-aware text highlighting for search results
 */

import { normalizeArabicForSearch } from "./arabic";

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
  const diacriticsRegex = /[\u064B-\u0652\u0640]/;

  for (let i = 0; i < original.length; i++) {
    if (!diacriticsRegex.test(original[i])) {
      map.push(i);
    }
  }

  return map;
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

  let match;
  while ((match = regex.exec(normalizedText)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  if (matches.length === 0) {
    return text;
  }

  // Map normalized positions back to original positions
  const originalMatches = matches.map(({ start, end }) => {
    const originalStart = positionMap[start];
    // end - 1 because end is exclusive
    const lastCharOriginalPos = positionMap[end - 1];

    // Find the end position including any trailing diacritics
    let originalEnd = lastCharOriginalPos + 1;
    const diacriticsRegex = /[\u064B-\u0652\u0640]/;
    while (
      originalEnd < text.length &&
      diacriticsRegex.test(text[originalEnd])
    ) {
      originalEnd++;
    }

    return { start: originalStart, end: originalEnd };
  });

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
