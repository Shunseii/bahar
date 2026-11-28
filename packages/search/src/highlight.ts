/**
 * Highlights what the user typed, literally: a word is marked when it starts
 * with a query word once harakat are stripped and hamza unified, with a leading
 * ال (or وال/بال/كال/فال/لل) optional on either side. English words also match
 * on their stem, so "arrives" marks "arrive".
 *
 * Whole words only. Splitting an Arabic word across spans breaks letter joining
 * and can drop harakat at the span edge, so a match marks the entire word.
 *
 * Results found another way (a plural, a typo, a shared root) get no highlight.
 */

import { normalizeArabicForSearch } from "./arabic";
import { englishTokenizer, stripDefiniteArticle } from "./tokenizer";

interface HighlightOptions {
  HTMLTag?: string;
  CSSClass?: string;
}

type Range = { start: number; end: number };

const WORD = /[\p{L}\p{M}]+/gu;
const ARABIC_LETTER = /[؀-ۿ]/;

const normalize = (word: string) =>
  normalizeArabicForSearch(word).toLowerCase();

const englishStem = (word: string) =>
  englishTokenizer.tokenize(word, "english", "translation")[0] ?? word;

const wordMatchesQueryWord = ({
  word,
  queryWord,
}: {
  word: string;
  queryWord: string;
}): boolean => {
  const text = normalize(word);
  const query = normalize(queryWord);

  if (text.startsWith(query)) return true;
  if (ARABIC_LETTER.test(queryWord)) {
    return stripDefiniteArticle(text).startsWith(stripDefiniteArticle(query));
  }
  return englishStem(text) === englishStem(query);
};

/**
 * Finds highlight ranges (whole words) in the original text.
 * Platform-agnostic core for HTML and React Native rendering.
 */
export const findHighlightPositions = (
  text: string,
  searchTerm: string
): Range[] => {
  const queryWords = searchTerm.match(WORD) ?? [];
  if (queryWords.length === 0) return [];

  const ranges: Range[] = [];
  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    if (
      queryWords.some((queryWord) => wordMatchesQueryWord({ word, queryWord }))
    ) {
      ranges.push({ start: match.index, end: match.index + word.length });
    }
  }
  return ranges;
};

/**
 * Wraps matching words in an HTML tag (default <mark>).
 */
export const highlightWithDiacritics = (
  text: string,
  searchTerm: string,
  options: HighlightOptions = {}
): string => {
  const { HTMLTag = "mark", CSSClass = "" } = options;
  const ranges = findHighlightPositions(text, searchTerm);
  if (ranges.length === 0) return text;

  const classAttr = CSSClass ? ` class="${CSSClass}"` : "";
  let result = "";
  let lastEnd = 0;
  for (const { start, end } of ranges) {
    result += text.slice(lastEnd, start);
    result += `<${HTMLTag}${classAttr}>${text.slice(start, end)}</${HTMLTag}>`;
    lastEnd = end;
  }
  return result + text.slice(lastEnd);
};
