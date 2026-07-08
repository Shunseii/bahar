/**
 * Dictionary-entries operations for mobile — thin wiring over the shared
 * @bahar/db-operations factory. Adapts to mobile's existing contract:
 * - `entry({ id })` returns null when missing (the shared factory takes a bare
 *   id and throws), so it's wrapped here.
 * - `addWord({ entry })` maps to the shared `{ word }` param.
 * - `entriesByIds` and `list` (paginated) are mobile-only and implemented here.
 */

import { makeDictionaryEntriesTable } from "@bahar/db-operations";
import {
  dictionaryEntries,
  type SelectDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { desc, inArray } from "drizzle-orm";
import { getDb } from "./get-db";

const base = makeDictionaryEntriesTable({ getDb });

type AddWordInput = Parameters<typeof base.addWord.mutation>[0]["word"];

export const dictionaryEntriesTable = {
  ...base,
  // Preserve mobile's no-arg tags query (the shared factory takes an optional
  // searchTerm, which breaks passing `.query` directly as a react-query
  // queryFn since react-query would pass its context object as that arg).
  tags: {
    query: (): Promise<{ tag: string; count: number }[]> => base.tags.query(),
    cacheOptions: base.tags.cacheOptions,
  },
  entry: {
    query: async ({
      id,
    }: {
      id: string;
    }): Promise<SelectDictionaryEntry | null> => {
      try {
        return await base.entry.query(id);
      } catch {
        return null;
      }
    },
    cacheOptions: base.entry.cacheOptions,
  },
  addWord: {
    mutation: ({
      entry,
    }: {
      entry: AddWordInput;
    }): Promise<SelectDictionaryEntry> =>
      base.addWord.mutation({ word: entry }),
    cacheOptions: base.addWord.cacheOptions,
  },
  entriesByIds: {
    query: async ({
      ids,
    }: {
      ids: string[];
    }): Promise<Map<string, SelectDictionaryEntry>> => {
      if (ids.length === 0) return new Map();
      const drizzleDb = await getDb();
      const rows = await drizzleDb
        .select()
        .from(dictionaryEntries)
        .where(inArray(dictionaryEntries.id, ids));
      return new Map(rows.map((row) => [row.id, row]));
    },
    cacheOptions: {
      queryKey: ["turso.dictionary-entries.entriesByIds"] as const,
    },
  },
  list: {
    query: async ({
      limit = 50,
      offset = 0,
    }: {
      limit?: number;
      offset?: number;
    } = {}): Promise<SelectDictionaryEntry[]> => {
      const drizzleDb = await getDb();
      return drizzleDb
        .select()
        .from(dictionaryEntries)
        .orderBy(desc(dictionaryEntries.created_at_timestamp_ms))
        .limit(limit)
        .offset(offset);
    },
    cacheOptions: {
      queryKey: ["turso.dictionary-entries.list"] as const,
    },
  },
};
