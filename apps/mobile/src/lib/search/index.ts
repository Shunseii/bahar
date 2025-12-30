/**
 * Orama search integration for mobile app.
 *
 * Uses the @bahar/search package for Arabic-aware search functionality.
 */

import { safeJsonParse } from "@bahar/db-operations";
import {
  AntonymSchema,
  ExampleSchema,
  MorphologySchema,
  type RawDictionaryEntry,
  RootLettersSchema,
  TagsSchema,
} from "@bahar/drizzle-user-db-schemas";
import { err, ok, type Result } from "@bahar/result";
import {
  createDictionaryDatabase,
  insertDocument,
  insertDocuments,
  removeDocument,
  searchDictionary,
  updateDocument,
} from "@bahar/search/database";
import type { DictionaryDocument, DictionaryOrama } from "@bahar/search/schema";
import { z } from "zod";
import { ensureDb } from "../db";

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
    console.error("[orama] Rehydration failed:", error);
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
 */
export const updateSearchIndex = async (
  id: string,
  entry: Partial<DictionaryDocument>
): Promise<void> => {
  const orama = getOramaDb();
  await updateDocument(orama, id, entry);
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

export { highlightWithDiacritics } from "@bahar/search/highlight";
