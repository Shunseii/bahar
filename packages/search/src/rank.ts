/**
 * Reorders search hits so a match on what the user sees -- the headword for an
 * Arabic query, a translation item for an English one -- comes first. Orama's
 * relevance score alone can rank another word with the same stem above an
 * exact match (حرمة returning حُرِمَ before حُرمَة).
 */

import { normalizeArabicForSearch } from "./arabic";
import { guessRootKeys } from "./root";
import type { DictionaryDocument } from "./schema";
import { stripDefiniteArticle } from "./tokenizer";

const TATWEEL = /ـ/g;
const TRANSLATION_SEPARATORS = /[,;/()]/;
const LEADING_TO = /^to /;
const WHITESPACE = /\s+/;

const normalize = (text?: string) =>
  normalizeArabicForSearch(text ?? "").trim();

const editDistance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
};

const rawArabicForms = (doc: DictionaryDocument): string[] => {
  const { ism, verb } = doc.morphology ?? {};
  return [
    ism?.singular,
    ...(ism?.plurals ?? []),
    verb?.past_tense,
    verb?.present_tense,
    ...(verb?.masadir ?? []),
  ].filter((form): form is string => Boolean(form));
};

const otherArabicForms = (doc: DictionaryDocument): string[] =>
  rawArabicForms(doc).map(normalize);

const translationItems = (translation: string): string[] =>
  translation
    .toLowerCase()
    .split(TRANSLATION_SEPARATORS)
    .map((item) => item.trim().replace(LEADING_TO, ""))
    .filter(Boolean);

/** Lower is better. Hits in the same tier keep Orama's order. */
const arabicTier = (
  doc: DictionaryDocument,
  term: string,
  rootKeys: string[]
): number => {
  const query = normalize(term);
  const queryWithoutArticle = stripDefiniteArticle(query);
  const headword = normalize(doc.word);
  const forms = otherArabicForms(doc);

  if (headword === query) {
    // Harakat only break ties between words that match once normalized: the
    // one spelled exactly as typed, with or without harakat, comes first.
    const spelledAsTyped =
      doc.word.replace(TATWEEL, "").trim() === term.replace(TATWEEL, "").trim();
    return spelledAsTyped ? 0 : 1;
  }
  if (forms.includes(query)) return 2;
  if (stripDefiniteArticle(headword) === queryWithoutArticle) return 3;
  if (
    forms.some((form) => stripDefiniteArticle(form) === queryWithoutArticle)
  ) {
    return 4;
  }
  if (headword.startsWith(query)) return 5;
  if (query.length >= 4 && editDistance(headword, query) <= 1) return 6;
  if (doc.root_key && rootKeys.includes(doc.root_key)) return 7;
  return 8;
};

const englishTier = (doc: DictionaryDocument, term: string): number => {
  const query = term.toLowerCase().trim();
  const items = translationItems(doc.translation ?? "");
  if (items.includes(query)) return 0;
  if (items.some((item) => item.split(WHITESPACE).includes(query))) return 1;
  return 8;
};

export const rankByVisibleMatch = <
  Hit extends { document: DictionaryDocument },
>({
  hits,
  term,
  language,
}: {
  hits: Hit[];
  term: string;
  language?: "arabic" | "english";
}): Hit[] => {
  const rootKeys = language === "arabic" ? guessRootKeys(term) : [];
  const tierOf = (doc: DictionaryDocument) =>
    language === "arabic"
      ? arabicTier(doc, term, rootKeys)
      : englishTier(doc, term);
  return hits
    .map((hit, index) => ({ hit, index, tier: tierOf(hit.document) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map(({ hit }) => hit);
};
