import {
  RawDictionaryEntry,
  SelectDictionaryEntry,
  RootLettersSchema,
  TagsSchema,
  AntonymSchema,
  ExampleSchema,
  MorphologySchema,
} from "@bahar/drizzle-user-db-schemas";
import { safeJsonParse, ok, err, type Result } from "../result";
import { z } from "zod";

export type ConvertDictionaryEntryError = {
  entryId: string;
  word: string;
  field: string;
  reason: string;
};

/**
 * Generates a SQL json_object clause from type-safe column names.
 * Extracts all keys from a type definition and creates key-value pairs for json_object().
 *
 * @example
 * // Input
 * columns = ['id', 'word', 'translation', 'tags']
 * tableAlias = 'd'
 * jsonObjectAlias = 'dictionary_entry'
 *
 * // Output
 * "json_object('id', d.id, 'word', d.word, 'translation', d.translation, 'tags', d.tags) as dictionary_entry"
 *
 * // Used in query as:
 * "SELECT f.*, json_object('id', d.id, 'word', d.word, ...) as dictionary_entry FROM flashcards f LEFT JOIN dictionary_entries d ON ..."
 */
export const buildSelectWithNestedJson = ({
  columns,
  tableAlias,
  jsonObjectAlias,
}: {
  columns: string[];
  tableAlias: string;
  jsonObjectAlias: string;
}): string => {
  const jsonPairs = columns
    .map((col) => `'${col}', ${tableAlias}.${col}`)
    .join(", ");

  return `json_object(${jsonPairs}) as ${jsonObjectAlias}`;
};

export const DICTIONARY_ENTRY_COLUMNS = [
  "id",
  "created_at",
  "created_at_timestamp_ms",
  "updated_at",
  "updated_at_timestamp_ms",
  "word",
  "translation",
  "definition",
  "type",
  "root",
  "tags",
  "antonyms",
  "examples",
  "morphology",
] satisfies (keyof SelectDictionaryEntry)[];

export const convertRawDictionaryEntryToSelectDictionaryEntry = (
  raw: RawDictionaryEntry,
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
