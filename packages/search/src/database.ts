/**
 * Orama database factory for dictionary search
 */

import {
  create,
  insert,
  insertMultiple,
  remove,
  search,
  update,
} from "@orama/orama";
import { pluginQPS } from "@orama/plugin-qps";
import {
  type DictionaryDocument,
  type DictionaryOrama,
  dictionarySchema,
} from "./schema";
import { multiLanguageTokenizer } from "./tokenizer";

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

/**
 * Searches the Orama database
 */
export const searchDictionary = (
  db: DictionaryOrama,
  term: string,
  options?: {
    limit?: number;
    offset?: number;
    properties?: SearchableProperties[];
  }
) => {
  return search(db, {
    term,
    limit: options?.limit ?? 10,
    offset: options?.offset ?? 0,
    properties: options?.properties,
  });
};
