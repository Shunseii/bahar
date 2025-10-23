import { create, insertMultiple } from "@orama/orama";
import { getDb } from "../db";
import { RawDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { multiLanguageTokenizer } from "./orama-tokenizer";
import { pluginQPS } from "@orama/plugin-qps";
import { Highlight } from "@orama/highlight";

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
 * Inserts all the words from the local turso user db
 * into orama.
 */
export const hydrateOramaDb = async () => {
  if (isOramaHydrated) return;

  let offset = 0;
  const BATCH_SIZE = 500;

  const db = getDb();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const results: RawDictionaryEntry[] = await db
      .prepare("SELECT * FROM dictionary_entries LIMIT ? OFFSET ?")
      .all([BATCH_SIZE, offset]);

    if (results.length === 0) break;

    // data from db call above can be null but not undefined, but
    // orama only accepts undefined, not null so using the data as-is
    // throws a type error so we convert all null values to undefined
    // along with parsing JSON values.
    const dictionaryEntries = results.map((entry) => ({
      id: entry.id,
      word: entry.word,
      translation: entry.translation,
      created_at: entry.created_at ?? undefined,
      created_at_timestamp_ms: entry.created_at_timestamp_ms ?? undefined,
      updated_at: entry.updated_at ?? undefined,
      updated_at_timestamp_ms: entry.updated_at_timestamp_ms ?? undefined,
      definition: entry.definition ?? undefined,
      type: entry.type ?? undefined,
      root: entry.root ? JSON.parse(entry.root) : undefined,
      tags: entry.tags ? JSON.parse(entry.tags) : undefined,
      antonyms: entry.antonyms ? JSON.parse(entry.antonyms) : undefined,
      examples: entry.examples ? JSON.parse(entry.examples) : undefined,
      morphology: entry.morphology ? JSON.parse(entry.morphology) : undefined,
    }));

    await insertMultiple(oramaDb, dictionaryEntries, BATCH_SIZE);

    offset += BATCH_SIZE;

    isOramaHydrated = true;
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
