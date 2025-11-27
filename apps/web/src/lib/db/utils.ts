import {
  RawDictionaryEntry,
  SelectDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";

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
  const jsonColumns = ["root", "tags", "antonyms", "examples", "morphology"];

  const jsonPairs = columns
    .map((col) => {
      if (jsonColumns.includes(col)) {
        return `'${col}', ${tableAlias}.${col}`;
      } else {
        // Escape backslashes and quotes in string columns
        return `'${col}', REPLACE(REPLACE(${tableAlias}.${col}, '\\', '\\\\'), '"', '\\"')`;
      }
    })
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
): SelectDictionaryEntry => {
  return {
    id: raw.id,
    created_at: raw.created_at,
    created_at_timestamp_ms: raw.created_at_timestamp_ms,
    updated_at: raw.updated_at,
    updated_at_timestamp_ms: raw.updated_at_timestamp_ms,
    word: raw.word,
    translation: raw.translation,
    definition: raw.definition,
    type: raw.type,
    root: raw.root ? JSON.parse(raw.root) : null,
    tags: raw.tags ? JSON.parse(raw.tags) : null,
    antonyms: raw.antonyms ? JSON.parse(raw.antonyms) : null,
    examples: raw.examples ? JSON.parse(raw.examples) : null,
    morphology: raw.morphology ? JSON.parse(raw.morphology) : null,
  };
};
