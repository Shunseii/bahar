import {
  SelectSetting,
  RawSetting,
  SelectDictionaryEntry,
  RawDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { getDb } from ".";
import { nanoid } from "nanoid";

/**
 * @file Operations to interact with the user database,
 * broken down by table.
 */

type TableOperation = {
  // Note: can't use a generic here to type the output
  // it will still be any when used with satisfies
  query?: () => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation?: (...args: any[]) => Promise<unknown>;
  /**
   * The cache options for the query in tanstack query.
   */
  cacheOptions: {
    // Prefix with turso to ensure there's no conflict
    // with trpc query keys.
    queryKey: `turso.${string}`[];
    staleTime?: number;
  };
};

export const settingsTable = {
  getSettings: {
    query: async (): Promise<Omit<SelectSetting, "id">> => {
      const db = getDb();
      const res: RawSetting = await db.prepare("SELECT * FROM settings").get();

      return {
        show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
        show_reverse_flashcards: Boolean(res.show_reverse_flashcards),
      };
    },
    cacheOptions: {
      queryKey: ["turso.settings.query"],
      staleTime: Infinity,
    },
  },
} satisfies Record<string, TableOperation>;

export const dictionaryEntriesTable = {
  addWord: {
    mutation: async (
      word: Omit<RawDictionaryEntry, "id">,
    ): Promise<SelectDictionaryEntry> => {
      const db = getDb();
      const id = nanoid();
      const now = new Date();
      const createdAt = now.toISOString();
      const createdAtTimestampMs = now.getTime();

      const res: RawDictionaryEntry = await db
        .prepare(
          `INSERT INTO dictionary_entries (
            id, word, translation, definition, type, root, tags, antonyms, examples, morphology,
            created_at, created_at_timestamp_ms, updated_at, updated_at_timestamp_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;`,
        )
        .get([
          id,
          word.word,
          word.translation,
          word.definition ?? null,
          word.type,
          word.root,
          word.tags,
          word.antonyms,
          word.examples,
          word.morphology,
          createdAt,
          createdAtTimestampMs,
          createdAt,
          createdAtTimestampMs,
        ]);

      return {
        id: res.id,
        created_at: res.created_at,
        created_at_timestamp_ms: res.created_at_timestamp_ms,
        updated_at: res.updated_at,
        updated_at_timestamp_ms: res.updated_at_timestamp_ms,
        word: res.word,
        translation: res.translation,
        definition: res.definition,
        type: res.type,
        root: res.root ? JSON.parse(res.root) : null,
        tags: res.tags ? JSON.parse(res.tags) : null,
        antonyms: res.antonyms ? JSON.parse(res.antonyms) : null,
        examples: res.examples ? JSON.parse(res.examples) : null,
        morphology: res.morphology ? JSON.parse(res.morphology) : null,
      };
    },
    cacheOptions: {
      queryKey: ["turso.dictionaryEntries.addWord"],
      staleTime: Infinity,
    },
  },
} satisfies Record<string, TableOperation>;
