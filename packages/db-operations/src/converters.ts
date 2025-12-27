/**
 * Data converters for transforming raw database results to typed objects.
 */

import {
  AntonymSchema,
  ExampleSchema,
  MorphologySchema,
  type RawDictionaryEntry,
  RootLettersSchema,
  type SelectDictionaryEntry,
  TagsSchema,
} from "@bahar/drizzle-user-db-schemas";
import { err, ok, type Result } from "@bahar/result";
import { z } from "zod";

/**
 * Error type for dictionary entry conversion failures.
 */
export interface ConvertDictionaryEntryError {
  entryId: string;
  word: string;
  field: string;
  reason: string;
}

/**
 * Safely parses JSON using Zod schema validation.
 * Returns a Result with null value on parse failure.
 */
export const safeJsonParse = <T extends z.ZodTypeAny>(
  json: string | null | undefined,
  schema: T
): Result<z.infer<T> | null> => {
  if (!json) {
    return ok(null);
  }

  try {
    const parsed = JSON.parse(json);
    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      return err(validated.error.issues);
    }
    return ok(validated.data);
  } catch (error) {
    if (error instanceof Error) {
      return err([{ message: error.message }]);
    }
    return err([{ message: "Unknown error" }]);
  }
};

/**
 * Converts a raw dictionary entry (with JSON strings) to a typed SelectDictionaryEntry.
 */
export const convertRawDictionaryEntryToSelect = (
  raw: RawDictionaryEntry
): Result<SelectDictionaryEntry, ConvertDictionaryEntryError> => {
  const rootResult = safeJsonParse(raw.root, RootLettersSchema);
  if (!rootResult.ok) {
    return err({
      entryId: raw.id,
      word: raw.word,
      field: "root",
      reason: JSON.stringify(rootResult.error),
    });
  }

  const tagsResult = safeJsonParse(raw.tags, TagsSchema);
  if (!tagsResult.ok) {
    return err({
      entryId: raw.id,
      word: raw.word,
      field: "tags",
      reason: JSON.stringify(tagsResult.error),
    });
  }

  const antonymsResult = safeJsonParse(raw.antonyms, z.array(AntonymSchema));
  if (!antonymsResult.ok) {
    return err({
      entryId: raw.id,
      word: raw.word,
      field: "antonyms",
      reason: JSON.stringify(antonymsResult.error),
    });
  }

  const examplesResult = safeJsonParse(raw.examples, z.array(ExampleSchema));
  if (!examplesResult.ok) {
    return err({
      entryId: raw.id,
      word: raw.word,
      field: "examples",
      reason: JSON.stringify(examplesResult.error),
    });
  }

  const morphologyResult = safeJsonParse(raw.morphology, MorphologySchema);
  if (!morphologyResult.ok) {
    return err({
      entryId: raw.id,
      word: raw.word,
      field: "morphology",
      reason: JSON.stringify(morphologyResult.error),
    });
  }

  return ok({
    id: raw.id,
    created_at: raw.created_at,
    created_at_timestamp_ms: raw.created_at_timestamp_ms,
    updated_at: raw.updated_at,
    updated_at_timestamp_ms: raw.updated_at_timestamp_ms,
    word: raw.word,
    translation: raw.translation,
    definition: raw.definition,
    type: raw.type,
    root: rootResult.value,
    tags: tagsResult.value,
    antonyms: antonymsResult.value,
    examples: examplesResult.value,
    morphology: morphologyResult.value,
  });
};

/**
 * Converts all null values in an object to undefined.
 */
export const nullToUndefined = <T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]: T[K] extends null ? undefined : Exclude<T[K], null> } => {
  const result = {} as Record<string, unknown>;

  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      const value = obj[key];
      result[key] = value === null ? undefined : value;
    }
  }

  return result as {
    [K in keyof T]: T[K] extends null ? undefined : Exclude<T[K], null>;
  };
};
