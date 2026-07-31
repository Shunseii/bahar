import { safeJsonParse } from "@bahar/db-operations";
import {
  AntonymSchema,
  ExampleSchema,
  flashcards,
  MorphologySchema,
  type RawDictionaryEntry,
  RootLettersSchema,
  TagsSchema,
} from "@bahar/drizzle-user-db-schemas";
import { err, ok } from "@bahar/result";
import {
  createDictionaryDatabase,
  getDocument,
  insertDocuments,
  updateDocument,
} from "@bahar/search/database";
import { toOramaDocument } from "@bahar/search/document";
import type { DictionaryOrama } from "@bahar/search/schema";
import * as Sentry from "@sentry/react";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { ensureDb, getDrizzleDb } from "../db";

let oramaDb = createDictionaryDatabase();

export const getOramaDb = () => oramaDb;

/**
 * Aggregates per-entry flashcard data that is folded into the search index:
 * the hardest card's difficulty and the most recent review timestamp across
 * either direction. Hidden cards are excluded.
 */
const buildFlashcardMaps = async () => {
  const drizzleDb = getDrizzleDb();

  const rows = await drizzleDb
    .select({
      entryId: flashcards.dictionary_entry_id,
      maxDifficulty: max(flashcards.difficulty).mapWith(Number),
      lastReviewed: max(flashcards.last_review_timestamp_ms).mapWith(Number),
    })
    .from(flashcards)
    .where(eq(flashcards.is_hidden, false))
    .groupBy(flashcards.dictionary_entry_id);

  const difficultyMap = new Map(
    rows.map((r) => [r.entryId, r.maxDifficulty ?? 0])
  );
  const lastReviewedMap = new Map(
    rows.map((r) => [r.entryId, r.lastReviewed ?? 0])
  );

  return { difficultyMap, lastReviewedMap };
};

/**
 * Reflects a flashcard grade in the search index so the "recently reviewed"
 * sort stays fresh without a full reindex. The just-graded review timestamp is
 * always the entry's most recent one (either direction), so it can be written
 * directly. Reads the current document first to avoid dropping other fields,
 * since Orama's update replaces the whole document.
 */
export const markEntryReviewedInIndex = (
  entryId: string,
  lastReviewTimestampMs: number
) => {
  const current = getDocument(oramaDb, entryId);
  if (!current) return;

  updateDocument(oramaDb, entryId, {
    ...current,
    last_review_timestamp_ms: lastReviewTimestampMs,
  });
};

let isOramaHydrated = false;

/**
 * Inserts all the words from the local turso user db into orama.
 * Gracefully skips entries with corrupted JSON data and reports them to Sentry.
 */
export const hydrateOramaDb = async () => {
  if (isOramaHydrated) return ok({ skippedCount: 0 });

  const BATCH_SIZE = 100;
  const db = await ensureDb();

  const { difficultyMap, lastReviewedMap } = await buildFlashcardMaps();

  let offset = 0;
  let skippedCount = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const results: RawDictionaryEntry[] = await db.all(
        "SELECT * FROM dictionary_entries LIMIT ? OFFSET ?",
        [BATCH_SIZE, offset]
      );

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
              }
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
              }
            );
          }

          const antonymsResult = safeJsonParse(
            entry.antonyms,
            z.array(AntonymSchema)
          );
          if (!antonymsResult.ok) {
            Sentry.logger.warn(
              "Orama hydration: antonyms field validation failed",
              {
                entryId: entry.id,
                word: entry.word,
                error: String(antonymsResult.error),
              }
            );
          }

          const examplesResult = safeJsonParse(
            entry.examples,
            z.array(ExampleSchema)
          );
          if (!examplesResult.ok) {
            Sentry.logger.warn(
              "Orama hydration: examples field validation failed",
              {
                entryId: entry.id,
                word: entry.word,
                error: String(examplesResult.error),
              }
            );
          }

          const morphologyResult = safeJsonParse(
            entry.morphology,
            MorphologySchema
          );
          if (!morphologyResult.ok && entry.morphology) {
            Sentry.logger.warn(
              "Orama hydration: morphology field validation failed",
              {
                entryId: entry.id,
                word: entry.word,
                error: String(morphologyResult.error),
              }
            );
          }

          if (!(rootResult.ok && tagsResult.ok)) {
            ++skippedCount;
            return null;
          }

          return toOramaDocument({
            entry: {
              ...entry,
              root: rootResult.value,
              tags: tagsResult.value,
              antonyms: antonymsResult.ok ? antonymsResult.value : null,
              examples: examplesResult.ok ? examplesResult.value : null,
              morphology: morphologyResult.ok ? morphologyResult.value : null,
            },
            maxDifficulty: difficultyMap.get(entry.id) ?? 0,
            lastReviewTimestampMs: lastReviewedMap.get(entry.id) ?? 0,
          });
        })
        .filter((entry) => entry !== null);

      if (dictionaryEntries.length > 0) {
        await insertDocuments(
          oramaDb as DictionaryOrama,
          dictionaryEntries,
          BATCH_SIZE
        );
      }

      offset += BATCH_SIZE;
    }

    isOramaHydrated = true;

    if (skippedCount > 0) {
      Sentry.captureMessage(
        `Orama hydration completed with ${skippedCount} entries skipped`,
        { level: "warning" }
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
  oramaDb = createDictionaryDatabase();

  isOramaHydrated = false;
};

export const rehydrateOramaDb = async () => {
  const BATCH_SIZE = 100;
  const db = await ensureDb();
  const newOramaDb = createDictionaryDatabase();

  const { difficultyMap, lastReviewedMap } = await buildFlashcardMaps();

  let offset = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const results: RawDictionaryEntry[] = await db.all(
        "SELECT * FROM dictionary_entries LIMIT ? OFFSET ?",
        [BATCH_SIZE, offset]
      );

      if (results.length === 0) break;

      const dictionaryEntries = results
        .map((entry) => {
          const rootResult = safeJsonParse(entry.root, RootLettersSchema);
          const tagsResult = safeJsonParse(entry.tags, TagsSchema);
          const antonymsResult = safeJsonParse(
            entry.antonyms,
            z.array(AntonymSchema)
          );
          const examplesResult = safeJsonParse(
            entry.examples,
            z.array(ExampleSchema)
          );
          const morphologyResult = safeJsonParse(
            entry.morphology,
            MorphologySchema
          );

          if (!(rootResult.ok && tagsResult.ok)) {
            return null;
          }

          return toOramaDocument({
            entry: {
              ...entry,
              root: rootResult.value,
              tags: tagsResult.value,
              antonyms: antonymsResult.ok ? antonymsResult.value : null,
              examples: examplesResult.ok ? examplesResult.value : null,
              morphology: morphologyResult.ok ? morphologyResult.value : null,
            },
            maxDifficulty: difficultyMap.get(entry.id) ?? 0,
            lastReviewTimestampMs: lastReviewedMap.get(entry.id) ?? 0,
          });
        })
        .filter((entry) => entry !== null);

      if (dictionaryEntries.length > 0) {
        await insertDocuments(
          newOramaDb as DictionaryOrama,
          dictionaryEntries,
          BATCH_SIZE
        );
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
