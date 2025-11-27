import { create, insertMultiple } from "@orama/orama";
import { getDb } from "../db";
import {
  RawDictionaryEntry,
  RootLettersSchema,
  TagsSchema,
  AntonymSchema,
  ExampleSchema,
} from "@bahar/drizzle-user-db-schemas";
import { multiLanguageTokenizer } from "./orama-tokenizer";
import { pluginQPS } from "@orama/plugin-qps";
import { Highlight } from "@orama/highlight";
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

export let oramaDb = createOramaDb();

let isOramaHydrated = false;

/**
 * Inserts all the words from the local turso user db into orama.
 * Gracefully skips entries with corrupted JSON data and reports them to Sentry.
 */
export const hydrateOramaDb = async () => {
  if (isOramaHydrated) return ok({ skippedCount: 0 });

  const BATCH_SIZE = 500;
  const db = getDb();

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

          if (
            !rootResult.ok ||
            !tagsResult.ok ||
            !antonymsResult.ok ||
            !examplesResult.ok
          ) {
            ++skippedCount;
            return null;
          }

          return {
            id: entry.id,
            word: entry.word,
            translation: entry.translation,
            created_at: entry.created_at ?? undefined,
            created_at_timestamp_ms: entry.created_at_timestamp_ms ?? undefined,
            updated_at: entry.updated_at ?? undefined,
            updated_at_timestamp_ms: entry.updated_at_timestamp_ms ?? undefined,
            definition: entry.definition ?? undefined,
            type: entry.type ?? undefined,
            root: rootResult.value ?? undefined,
            tags: tagsResult.value ?? undefined,
            antonyms: antonymsResult.value ?? undefined,
            examples: examplesResult.value ?? undefined,
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

export const oramaMatchHighlighter = new Highlight();

if (import.meta.hot) {
  import.meta.hot.accept(["./orama-tokenizer"], async () => {
    resetOramaDb();
    await hydrateOramaDb();
  });
}
