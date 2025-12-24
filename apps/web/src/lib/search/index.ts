import { create, insertMultiple } from "@orama/orama";
import { ensureDb } from "../db";
import {
  RawDictionaryEntry,
  RootLettersSchema,
  TagsSchema,
  AntonymSchema,
  ExampleSchema,
  MorphologySchema,
} from "@bahar/drizzle-user-db-schemas";
import { multiLanguageTokenizer } from "./orama-tokenizer";
import { pluginQPS } from "@orama/plugin-qps";
import {
  stripArabicDiacritics,
  normalizeArabicHamza,
  normalizeArabicWeakLetters,
} from "../utils";
import { safeJsonParse, ok, err } from "../result";
import * as Sentry from "@sentry/react";
import { z } from "zod";

const formatElapsedTime = (number: bigint): string | number | object => {
  const ONE_MS_IN_NS = 1_000_000n;

  const numInMs = number / ONE_MS_IN_NS;

  if (numInMs < 1n) {
    return { raw: number, formatted: "<1ms" };
  }

  return {
    raw: number,
    formatted: `${numInMs}ms`,
  };
};

const createOramaDb = () =>
  create({
    schema: {
      created_at_timestamp_ms: "number",
      updated_at_timestamp_ms: "number",
      word: "string",
      translation: "string",
      definition: "string",
      type: "enum",
      root: "string[]",
      tags: "string[]",
      // TODO: add more fields from morphology
    },
    plugins: [pluginQPS()],
    components: {
      tokenizer: multiLanguageTokenizer,
      formatElapsedTime,
    },
  });

let oramaDb = createOramaDb();

export const getOramaDb = () => oramaDb;

let isOramaHydrated = false;

/**
 * Inserts all the words from the local turso user db into orama.
 * Gracefully skips entries with corrupted JSON data and reports them to Sentry.
 */
export const hydrateOramaDb = async () => {
  if (isOramaHydrated) return ok({ skippedCount: 0 });

  const BATCH_SIZE = 100;
  const db = await ensureDb();

  let offset = 0;
  let skippedCount = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const results: RawDictionaryEntry[] = await db
        .prepare("SELECT * FROM dictionary_entries LIMIT ? OFFSET ?")
        .all([BATCH_SIZE, offset]);

      if (results.length === 0) break;

      const dictionaryEntries = results
        .map((entry) => {
          const rootResult = safeJsonParse(entry.root, RootLettersSchema);
          if (!rootResult.ok) {
            Sentry.logger.warn(
              "Orama hydration: root field validation failed",
              {
                entryId: entry.id,
                word: entry.word,
                error: String(rootResult.error),
              },
            );
          }

          const tagsResult = safeJsonParse(entry.tags, TagsSchema);
          if (!tagsResult.ok) {
            Sentry.logger.warn(
              "Orama hydration: tags field validation failed",
              {
                entryId: entry.id,
                word: entry.word,
                error: String(tagsResult.error),
              },
            );
          }

          const antonymsResult = safeJsonParse(
            entry.antonyms,
            z.array(AntonymSchema),
          );
          if (!antonymsResult.ok) {
            Sentry.logger.warn(
              "Orama hydration: antonyms field validation failed",
              {
                entryId: entry.id,
                word: entry.word,
                error: String(antonymsResult.error),
              },
            );
          }

          const examplesResult = safeJsonParse(
            entry.examples,
            z.array(ExampleSchema),
          );
          if (!examplesResult.ok) {
            Sentry.logger.warn(
              "Orama hydration: examples field validation failed",
              {
                entryId: entry.id,
                word: entry.word,
                error: String(examplesResult.error),
              },
            );
          }

          const morphologyResult = safeJsonParse(
            entry.morphology,
            MorphologySchema,
          );
          if (!morphologyResult.ok && entry.morphology) {
            Sentry.logger.warn(
              "Orama hydration: morphology field validation failed",
              {
                entryId: entry.id,
                word: entry.word,
                error: String(morphologyResult.error),
              },
            );
          }

          if (!rootResult.ok || !tagsResult.ok) {
            ++skippedCount;
            return null;
          }

          return {
            id: entry.id,
            word: entry.word,
            translation: entry.translation,
            created_at_timestamp_ms: entry.created_at_timestamp_ms ?? undefined,
            updated_at_timestamp_ms: entry.updated_at_timestamp_ms ?? undefined,
            definition: entry.definition ?? undefined,
            type: entry.type ?? undefined,
            root: rootResult.value ?? undefined,
            tags: tagsResult.value ?? undefined,
          };
        })
        .filter((entry) => entry !== null);

      if (dictionaryEntries.length > 0) {
        await insertMultiple(oramaDb, dictionaryEntries, BATCH_SIZE);
      }

      offset += BATCH_SIZE;
    }

    isOramaHydrated = true;

    if (skippedCount > 0) {
      Sentry.captureMessage(
        `Orama hydration completed with ${skippedCount} entries skipped`,
        { level: "warning" },
      );
    }

    return ok({ skippedCount });
  } catch (error) {
    Sentry.captureException(error, {
      contexts: {
        orama_hydration: {
          stage: "hydration_failed",
        },
      },
    });

    return err({ type: "hydration_failed", reason: String(error) });
  }
};

export const resetOramaDb = () => {
  oramaDb = createOramaDb();

  isOramaHydrated = false;
};

export const rehydrateOramaDb = async () => {
  const BATCH_SIZE = 100;
  const db = await ensureDb();
  const newOramaDb = createOramaDb();

  let offset = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const results: RawDictionaryEntry[] = await db
        .prepare("SELECT * FROM dictionary_entries LIMIT ? OFFSET ?")
        .all([BATCH_SIZE, offset]);

      if (results.length === 0) break;

      const dictionaryEntries = results
        .map((entry) => {
          const rootResult = safeJsonParse(entry.root, RootLettersSchema);
          const tagsResult = safeJsonParse(entry.tags, TagsSchema);

          if (!rootResult.ok || !tagsResult.ok) {
            return null;
          }

          return {
            id: entry.id,
            word: entry.word,
            translation: entry.translation,
            created_at_timestamp_ms: entry.created_at_timestamp_ms ?? undefined,
            updated_at_timestamp_ms: entry.updated_at_timestamp_ms ?? undefined,
            definition: entry.definition ?? undefined,
            type: entry.type ?? undefined,
            root: rootResult.value ?? undefined,
            tags: tagsResult.value ?? undefined,
          };
        })
        .filter((entry) => entry !== null);

      if (dictionaryEntries.length > 0) {
        await insertMultiple(newOramaDb, dictionaryEntries, BATCH_SIZE);
      }

      offset += BATCH_SIZE;
    }

    oramaDb = newOramaDb;
    isOramaHydrated = true;
  } catch (error) {
    Sentry.captureException(error, {
      contexts: { orama_rehydration: { stage: "rehydration_failed" } },
    });
  }
};

interface HighlightOptions {
  HTMLTag?: string;
  CSSClass?: string;
}

const normalizeArabicForMatching = (text: string): string => {
  return normalizeArabicWeakLetters(
    normalizeArabicHamza(stripArabicDiacritics(text)),
  );
};

/**
 * Creates a mapping from normalized text positions to original text positions.
 * Only diacritics are skipped (not counted as positions).
 * Hamza and weak letter normalization preserves position count.
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
  options: HighlightOptions = {},
): string => {
  const { HTMLTag = "mark", CSSClass = "" } = options;

  if (!searchTerm.trim()) {
    return text;
  }

  const normalizedText = normalizeArabicForMatching(text);
  const normalizedTerm = normalizeArabicForMatching(searchTerm);
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

if (import.meta.hot) {
  import.meta.hot.accept(["./orama-tokenizer"], async () => {
    resetOramaDb();
    await hydrateOramaDb();
  });
}
