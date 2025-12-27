import { ensureDb } from "../db";
import {
  RawDictionaryEntry,
  RootLettersSchema,
  TagsSchema,
  AntonymSchema,
  ExampleSchema,
  MorphologySchema,
} from "@bahar/drizzle-user-db-schemas";
import { ok, err } from "@bahar/result";
import { safeJsonParse } from "@bahar/db-operations";
import {
  createDictionaryDatabase,
  insertDocuments,
  type DictionaryOrama,
} from "@bahar/search";
import * as Sentry from "@sentry/react";
import { z } from "zod";

let oramaDb = createDictionaryDatabase();

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
        await insertDocuments(
          oramaDb as DictionaryOrama,
          dictionaryEntries,
          BATCH_SIZE,
        );
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
  oramaDb = createDictionaryDatabase();

  isOramaHydrated = false;
};

export const rehydrateOramaDb = async () => {
  const BATCH_SIZE = 100;
  const db = await ensureDb();
  const newOramaDb = createDictionaryDatabase();

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
        await insertDocuments(
          newOramaDb as DictionaryOrama,
          dictionaryEntries,
          BATCH_SIZE,
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
