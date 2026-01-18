/**
 * Orama database factory for dictionary search
 */

import {
  create,
  type InternalTypedDocument,
  insert,
  insertMultiple,
  type Results,
  remove,
  type SearchParamsFullText,
  search,
  update,
} from "@orama/orama";
import { pluginQPS } from "@orama/plugin-qps";
import { stripArabicDiacritics } from "./arabic";
import {
  type DictionaryDocument,
  type DictionaryOrama,
  dictionarySchema,
} from "./schema";
import { multiLanguageTokenizer } from "./tokenizer";

type SearchResults = Results<InternalTypedDocument<DictionaryDocument>>;

/**
 * Formats elapsed time for Orama internal logging
 */
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

/**
 * Creates a new Orama database instance for dictionary search
 */
export const createDictionaryDatabase = (): DictionaryOrama => {
  return create({
    schema: dictionarySchema,
    plugins: [pluginQPS()],
    components: {
      tokenizer: multiLanguageTokenizer,
      formatElapsedTime,
    },
  });
};

/**
 * Inserts multiple documents into the Orama database
 */
export const insertDocuments = async (
  db: DictionaryOrama,
  documents: DictionaryDocument[],
  batchSize = 500
): Promise<void> => {
  await insertMultiple(db, documents, batchSize);
};

/**
 * Inserts a single document into the Orama database
 */
export const insertDocument = (
  db: DictionaryOrama,
  document: DictionaryDocument
) => {
  return insert(db, document);
};

/**
 * Updates a document in the Orama database
 * Returns the document ID on success
 */
export const updateDocument = (
  db: DictionaryOrama,
  id: string,
  document: Partial<DictionaryDocument>
) => {
  return update(db, id, document);
};

/**
 * Removes a document from the Orama database
 */
export const removeDocument = (db: DictionaryOrama, id: string) => {
  return remove(db, id);
};

type SearchableProperties = keyof typeof dictionarySchema;

export const PROPERTIES: SearchableProperties[] = [
  "word",
  "translation",
  "definition",
  "morphology.ism.plurals",
  "morphology.ism.singular",
  "morphology.verb.masadir",
  "morphology.verb.past_tense",
  "morphology.verb.present_tense",
];

/**
 * Boost configuration for normalized field search
 */
export const BOOST = {
  word: 10,
  translation: 10,
  "morphology.ism.plurals": 10,
  "morphology.ism.singular": 10,
  "morphology.verb.masadir": 10,
  "morphology.verb.past_tense": 10,
  "morphology.verb.present_tense": 10,
} as const;

export type SearchLanguage = "arabic" | "english";

export type SearchDictionaryOptions = {
  limit?: number;
  offset?: number;
  properties?: SearchableProperties[];
  language?: SearchLanguage;
  where?: SearchParamsFullText<DictionaryOrama>["where"];
  sortBy?: SearchParamsFullText<DictionaryOrama>["sortBy"];
};

/**
 * Searches the Orama database using two-pass search for better relevance.
 * Results are merged with exact matches prioritized.
 */
export const searchDictionary = (
  db: DictionaryOrama,
  term: string,
  options?: SearchDictionaryOptions
) => {
  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;
  const language = options?.language;

  if (!term) {
    return search(
      db,
      {
        term,
        limit,
        offset,
        where: options?.where,
        sortBy: options?.sortBy,
      },
      language
    );
  }

  const termLen = stripArabicDiacritics(term).length;

  // Fetch enough results to cover offset + limit for proper pagination
  const fetchLimit = offset + limit;

  // Pass 1: Exact match search
  const exactResults = search(
    db,
    {
      term,
      mode: "fulltext",
      limit: fetchLimit,
      properties: PROPERTIES,
      where: options?.where,
      sortBy: options?.sortBy,
      exact: true,
    },
    language
  ) as SearchResults;

  // Pass 2: Fuzzy search on normalized fields
  const fuzzyTolerance = termLen <= 2 ? 0 : termLen <= 4 ? 1 : 2;
  const fuzzyResults = search(
    db,
    {
      term,
      mode: "fulltext",
      limit: fetchLimit,
      properties: PROPERTIES,
      boost: BOOST,
      tolerance: fuzzyTolerance,
      where: options?.where,
      sortBy: options?.sortBy,
    },
    language
  ) as SearchResults;

  // Merge results: exact matches first, then fuzzy (deduplicated)
  const exactIds = new Set(exactResults.hits.map((h) => h.id));
  const mergedHits = [
    ...exactResults.hits,
    ...fuzzyResults.hits.filter((h) => !exactIds.has(h.id)),
  ].slice(offset, offset + limit);

  const estimatedCount = Math.max(exactResults.count, fuzzyResults.count);

  return {
    elapsed: exactResults.elapsed,
    count: estimatedCount,
    hits: mergedHits,
  } as SearchResults;
};
