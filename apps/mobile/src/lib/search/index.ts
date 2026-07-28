/**
 * Orama search integration for mobile app.
 *
 * Uses the @bahar/search package for Arabic-aware search functionality.
 */

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
import { err, ok, type Result } from "@bahar/result";
import {
  createDictionaryDatabase,
  getDocument,
  insertDocument,
  insertDocuments,
  removeDocument,
  searchDictionary,
  updateDocument,
} from "@bahar/search/database";
import type { DictionaryDocument, DictionaryOrama } from "@bahar/search/schema";
import * as Sentry from "@sentry/react-native";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { ensureDb } from "../db";
import { getDrizzleDb } from "../db/adapter";

/**
 * Aggregates per-entry flashcard data folded into the search index: the
 * hardest card's difficulty and the most recent review timestamp across either
 * direction. Hidden cards are excluded.
 */
const buildFlashcardMaps = async (): Promise<{
  difficultyMap: Map<string, number>;
  lastReviewedMap: Map<string, number>;
}> => {
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

  return {
    difficultyMap: new Map(rows.map((r) => [r.entryId, r.maxDifficulty ?? 0])),
    lastReviewedMap: new Map(rows.map((r) => [r.entryId, r.lastReviewed ?? 0])),
  };
};

const BATCH_SIZE = 500;

let oramaDb: DictionaryOrama | null = null;
let isHydrated = false;

/**
 * Gets the Orama database instance.
 */
export const getOramaDb = (): DictionaryOrama => {
  if (!oramaDb) {
    oramaDb = createDictionaryDatabase();
  }
  return oramaDb;
};

/**
 * Resets the Orama database and marks it as not hydrated.
 */
export const resetOramaDb = (): void => {
  oramaDb = createDictionaryDatabase();
  isHydrated = false;
};

/**
 * Rehydrates the Orama database by building a new index and atomically swapping.
 * This prevents UI flashing during reindexing.
 */
export const rehydrateOramaDb = async (): Promise<void> => {
  const db = await ensureDb();
  const newOramaDb = createDictionaryDatabase();

  const { difficultyMap, lastReviewedMap } = await buildFlashcardMaps();

  let offset = 0;

  try {
    while (true) {
      const results = await db
        .prepare<RawDictionaryEntry>(
          "SELECT * FROM dictionary_entries LIMIT ? OFFSET ?"
        )
        .all([BATCH_SIZE, offset]);

      if (results.length === 0) break;

      const documents: DictionaryDocument[] = [];

      for (const entry of results) {
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

        if (
          !(
            rootResult.ok &&
            tagsResult.ok &&
            antonymsResult.ok &&
            examplesResult.ok
          )
        ) {
          continue;
        }

        const morphology = morphologyResult.ok
          ? morphologyResult.value
          : undefined;

        documents.push({
          id: entry.id,
          word: entry.word,
          word_exact: entry.word,
          translation: entry.translation,
          created_at: entry.created_at ?? undefined,
          created_at_timestamp_ms: entry.created_at_timestamp_ms ?? undefined,
          updated_at: entry.updated_at ?? undefined,
          updated_at_timestamp_ms: entry.updated_at_timestamp_ms ?? undefined,
          max_difficulty: difficultyMap.get(entry.id) ?? 0,
          last_review_timestamp_ms: lastReviewedMap.get(entry.id) ?? 0,
          definition: entry.definition ?? undefined,
          type: entry.type ?? undefined,
          root: rootResult.value ?? undefined,
          tags: tagsResult.value ?? undefined,
          morphology: morphology
            ? {
                ism: morphology.ism
                  ? {
                      singular: morphology.ism.singular,
                      plurals: morphology.ism.plurals?.map((p) => p.word),
                      singular_exact: morphology.ism.singular,
                      plurals_exact: morphology.ism.plurals?.map((p) => p.word),
                    }
                  : undefined,
                verb: morphology.verb
                  ? {
                      past_tense: morphology.verb.past_tense,
                      present_tense: morphology.verb.present_tense,
                      masadir: morphology.verb.masadir?.map((m) => m.word),
                      past_tense_exact: morphology.verb.past_tense,
                      present_tense_exact: morphology.verb.present_tense,
                      masadir_exact: morphology.verb.masadir?.map(
                        (m) => m.word
                      ),
                    }
                  : undefined,
              }
            : undefined,
        });
      }

      if (documents.length > 0) {
        await insertDocuments(newOramaDb, documents, BATCH_SIZE);
      }

      offset += BATCH_SIZE;
    }

    oramaDb = newOramaDb;
    isHydrated = true;
  } catch (error) {
    Sentry.captureException(error, {
      fingerprint: ["orama-rehydration-error"],
      contexts: { orama_hydration: { stage: "rehydration_failed" } },
    });
  }
};

/**
 * Hydrates the Orama database with dictionary entries from local SQLite.
 */
export const hydrateOramaDb = async (): Promise<
  Result<{ skippedCount: number }, { type: string; reason: string }>
> => {
  if (isHydrated) return ok({ skippedCount: 0 });

  const db = await ensureDb();
  const orama = getOramaDb();

  const { difficultyMap, lastReviewedMap } = await buildFlashcardMaps();

  let offset = 0;
  let skippedCount = 0;
  let totalProcessed = 0;

  try {
    console.log("[orama] Starting hydration...");
    while (true) {
      const results = await db
        .prepare<RawDictionaryEntry>(
          "SELECT * FROM dictionary_entries LIMIT ? OFFSET ?"
        )
        .all([BATCH_SIZE, offset]);

      console.log(
        `[orama] Fetched ${results.length} entries at offset ${offset}`
      );
      if (results.length === 0) break;

      const documents: DictionaryDocument[] = [];

      for (const entry of results) {
        // Log data types for first entry to debug
        if (offset === 0 && documents.length === 0) {
          console.log("[orama] First entry data types:", {
            root: typeof entry.root,
            tags: typeof entry.tags,
            antonyms: typeof entry.antonyms,
            examples: typeof entry.examples,
          });
        }

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

        if (
          !(
            rootResult.ok &&
            tagsResult.ok &&
            antonymsResult.ok &&
            examplesResult.ok
          )
        ) {
          if (skippedCount < 5) {
            // Only log first 5 parse errors to avoid spam
            console.warn(`[orama] Skipping entry ${entry.id} (${entry.word})`);
            if (!rootResult.ok)
              console.warn(
                "  root error:",
                JSON.stringify(rootResult.error, null, 2)
              );
            if (!tagsResult.ok)
              console.warn(
                "  tags error:",
                JSON.stringify(tagsResult.error, null, 2)
              );
            if (!antonymsResult.ok)
              console.warn(
                "  antonyms error:",
                JSON.stringify(antonymsResult.error, null, 2)
              );
            if (!examplesResult.ok)
              console.warn(
                "  examples error:",
                JSON.stringify(examplesResult.error, null, 2)
              );
            console.warn(
              "  Raw data:",
              JSON.stringify(
                {
                  root: entry.root,
                  tags: entry.tags,
                  antonyms: entry.antonyms,
                  examples: entry.examples,
                },
                null,
                2
              )
            );
          }
          skippedCount++;
          continue;
        }

        const morphology = morphologyResult.ok
          ? morphologyResult.value
          : undefined;

        documents.push({
          id: entry.id,
          word: entry.word,
          word_exact: entry.word,
          translation: entry.translation,
          created_at: entry.created_at ?? undefined,
          created_at_timestamp_ms: entry.created_at_timestamp_ms ?? undefined,
          updated_at: entry.updated_at ?? undefined,
          updated_at_timestamp_ms: entry.updated_at_timestamp_ms ?? undefined,
          max_difficulty: difficultyMap.get(entry.id) ?? 0,
          last_review_timestamp_ms: lastReviewedMap.get(entry.id) ?? 0,
          definition: entry.definition ?? undefined,
          type: entry.type ?? undefined,
          root: rootResult.value ?? undefined,
          tags: tagsResult.value ?? undefined,
          morphology: morphology
            ? {
                ism: morphology.ism
                  ? {
                      singular: morphology.ism.singular,
                      plurals: morphology.ism.plurals?.map((p) => p.word),
                      singular_exact: morphology.ism.singular,
                      plurals_exact: morphology.ism.plurals?.map((p) => p.word),
                    }
                  : undefined,
                verb: morphology.verb
                  ? {
                      past_tense: morphology.verb.past_tense,
                      present_tense: morphology.verb.present_tense,
                      masadir: morphology.verb.masadir?.map((m) => m.word),
                      past_tense_exact: morphology.verb.past_tense,
                      present_tense_exact: morphology.verb.present_tense,
                      masadir_exact: morphology.verb.masadir?.map(
                        (m) => m.word
                      ),
                    }
                  : undefined,
              }
            : undefined,
        });
      }

      if (documents.length > 0) {
        console.log(
          `[orama] Inserting ${documents.length} documents into Orama`
        );
        await insertDocuments(orama, documents, BATCH_SIZE);
        totalProcessed += documents.length;
      }

      offset += BATCH_SIZE;
    }

    isHydrated = true;
    console.log(
      `[orama] Hydration complete. Processed: ${totalProcessed}, Skipped: ${skippedCount}`
    );
    return ok({ skippedCount });
  } catch (error) {
    console.error("[orama] Hydration failed:", error);
    return err({
      type: "hydration_failed",
      reason: String(error),
    });
  }
};

/**
 * Adds a document to the Orama index.
 */
export const addToSearchIndex = async (
  entry: DictionaryDocument
): Promise<void> => {
  const orama = getOramaDb();
  await insertDocument(orama, entry);
};

/**
 * Updates a document in the Orama index.
 *
 * Orama's update replaces the whole document, so a partial update is merged
 * over the current one. This keeps index-only fields (morphology, timestamps,
 * max_difficulty, last_review_timestamp_ms) that callers don't pass from being
 * dropped on edit. No-ops when the document isn't indexed.
 */
export const updateSearchIndex = async (
  id: string,
  entry: Partial<DictionaryDocument>
): Promise<void> => {
  const orama = getOramaDb();
  const current = getDocument(orama, id);
  if (!current) return;

  await updateDocument(orama, id, { ...current, ...entry });
};

/**
 * Reflects a flashcard grade in the search index so the "recently reviewed"
 * sort stays fresh without a full reindex. The just-graded review timestamp is
 * always the entry's most recent one (either direction), so it can be written
 * directly.
 */
export const markEntryReviewedInIndex = async (
  entryId: string,
  lastReviewTimestampMs: number
): Promise<void> => {
  await updateSearchIndex(entryId, {
    last_review_timestamp_ms: lastReviewTimestampMs,
  });
};

/**
 * Removes a document from the Orama index.
 */
export const removeFromSearchIndex = async (id: string): Promise<void> => {
  const orama = getOramaDb();
  await removeDocument(orama, id);
};

/**
 * Searches the dictionary.
 */
export const search = async (
  term: string,
  options?: { limit?: number; offset?: number }
) => {
  const orama = getOramaDb();
  return searchDictionary(orama, term, options);
};

export {
  findHighlightPositions,
  highlightWithDiacritics,
} from "@bahar/search/highlight";
