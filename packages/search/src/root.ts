/**
 * Guesses the three-letter root of a typed Arabic word by matching it against
 * common derivation patterns (تفعيل، استفعال، مفعول ...). It returns every
 * candidate rather than one answer: a wrong guess rarely equals a root that is
 * actually stored on an entry, so the extra candidates cost little.
 */

import { normalizeArabicForSearch } from "./arabic";

/** ف ع ل mark the root letters; every other letter is literal. */
const PATTERNS = [
  "فعل",
  "فاعل",
  "فعيل",
  "فعال",
  "فعول",
  "فعلة",
  "فعلى",
  "فعالة",
  "فعيلة",
  "فعلاء",
  "افعل",
  "افعال",
  "افعلة",
  "افعلاء",
  "فواعل",
  "فعائل",
  "فعاعل",
  "فعالل",
  "مفعل",
  "مفعلة",
  "مفعول",
  "مفاعل",
  "مفاعيل",
  "مفعال",
  "مفعيل",
  "يفعل",
  "تفعل",
  "نفعل",
  "فعّل",
  "تفعيل",
  "تفعلة",
  "تفاعل",
  "تفاعيل",
  "مفاعلة",
  "فعالي",
  "انفعل",
  "انفعال",
  "ينفعل",
  "منفعل",
  "افتعل",
  "افتعال",
  "يفتعل",
  "مفتعل",
  "تفتعل",
  "استفعل",
  "استفعال",
  "يستفعل",
  "مستفعل",
  "تستفعل",
  "يتفعل",
  "يتفاعل",
  "متفعل",
  "متفاعل",
  "تتفعل",
];

const toRegex = (pattern: string) =>
  new RegExp(
    `^${normalizeArabicForSearch(pattern)
      .replace(/ّ/g, "")
      .replace(/[فعل]/g, "(.)")}$`
  );

const PATTERN_REGEXES = PATTERNS.map(toRegex);

const PREFIXES = /^(وال|بال|كال|فال|لل|ال|و|ف|ب|ل|ك)/;
const SUFFIXES = /(ات|ون|ين|ان|وا|تم|نا|هم|ها|كم|ة|ه|ي|ك|ت)$/;

const WEAK = /[اويىئؤء]/g;
const WHITESPACE = /\s/;
const PRESENT_TENSE_PREFIX = /^[يتنا]/;

/** Weak letters (ا و ي and hamza) collapse to one symbol so قال and قول meet. */
export const rootKey = (letters: string[]): string =>
  letters
    .map((l) => normalizeArabicForSearch(l))
    .join("")
    .replace(WEAK, "*");

const stems = (word: string): string[] => {
  const withoutPrefix = word.replace(PREFIXES, "");
  const candidates = [word, withoutPrefix];
  for (const w of [word, withoutPrefix]) {
    const withoutSuffix = w.replace(SUFFIXES, "");
    if (withoutSuffix.length >= 2) candidates.push(withoutSuffix);
  }
  return [...new Set(candidates)];
};

/** Root keys the word could come from; empty for words too short to judge. */
export const guessRootKeys = (word: string): string[] => {
  const normalized = normalizeArabicForSearch(word).trim();
  if (WHITESPACE.test(normalized)) return [];
  if (normalized.length === 2 && word.includes("ّ")) {
    return [rootKey([normalized[0], normalized[1], normalized[1]])];
  }
  if (normalized.length < 3) return [];

  const keys = new Set<string>();
  for (const stem of stems(normalized)) {
    // A doubled root loses a letter once the shadda is stripped: شرّة → شر.
    if (stem.length === 2) keys.add(rootKey([stem[0], stem[1], stem[1]]));
    // Present tense of a doubled verb: يضر → ضرر.
    if (stem.length === 3 && PRESENT_TENSE_PREFIX.test(stem)) {
      keys.add(rootKey([stem[1], stem[2], stem[2]]));
    }
    for (const regex of PATTERN_REGEXES) {
      const match = stem.match(regex);
      if (match) keys.add(rootKey(match.slice(1)));
    }
  }
  return [...keys];
};
