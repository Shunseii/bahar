import {
  dictionaryEntries,
  flashcards,
  type InsertDictionaryEntry,
  type SelectDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { eq, max, sql } from "drizzle-orm";
import { nanoid } from "nanoid/non-secure";
import { enqueueDbOperation } from "../queue";
import type { NullToUndefined, TableOperation } from "../types";
import type { OperationDeps } from "./deps";

export const makeDictionaryEntriesTable = ({ getDb }: OperationDeps) =>
  ({
    entry: {
      query: async (id: string): Promise<SelectDictionaryEntry> => {
        const drizzleDb = await getDb();

        const [res] = await drizzleDb
          .select()
          .from(dictionaryEntries)
          .where(eq(dictionaryEntries.id, id))
          .limit(1);

        if (!res) {
          throw new Error(`Dictionary entry not found: ${id}`);
        }

        return res;
      },
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.entry.query"],
      },
    },
    tags: {
      query: async (
        searchTerm?: string
      ): Promise<{ tag: string; count: number }[]> => {
        const drizzleDb = await getDb();

        // json_each in the FROM clause has no drizzle query-builder form, so
        // this stays raw. drizzleDb.all() returns positional rows, mapped back
        // to { tag, count } by the SELECT column order below.
        const rows = await drizzleDb.all<[string, number]>(
          searchTerm
            ? sql`SELECT value as tag, COUNT(*) as count
                   FROM dictionary_entries, json_each(${dictionaryEntries.tags})
                   WHERE value IS NOT NULL AND value LIKE '%' || ${searchTerm} || '%'
                   GROUP BY value
                   ORDER BY count DESC`
            : sql`SELECT value as tag, COUNT(*) as count
                   FROM dictionary_entries, json_each(${dictionaryEntries.tags})
                   WHERE value IS NOT NULL
                   GROUP BY value
                   ORDER BY count DESC`
        );

        return rows.map(([tag, count]) => ({ tag, count: Number(count) }));
      },
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.tags.query"],
      },
    },
    addWord: {
      mutation: ({
        word,
      }: {
        word: Omit<
          NullToUndefined<InsertDictionaryEntry>,
          | "id"
          | "created_at"
          | "updated_at"
          | "created_at_timestamp_ms"
          | "updated_at_timestamp_ms"
        >;
      }): Promise<SelectDictionaryEntry> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();
          const now = new Date();

          const [res] = await drizzleDb
            .insert(dictionaryEntries)
            .values({
              id: nanoid(),
              word: word.word,
              translation: word.translation,
              definition: word.definition ?? null,
              type: word.type,
              root: word.root ?? null,
              tags: word.tags ?? null,
              antonyms: word.antonyms ?? null,
              examples: word.examples ?? null,
              morphology: word.morphology ?? null,
              created_at: now.toISOString(),
              created_at_timestamp_ms: now.getTime(),
              updated_at: now.toISOString(),
              updated_at_timestamp_ms: now.getTime(),
            })
            .returning();

          if (!res) {
            throw new Error(
              "Failed to retrieve newly created dictionary entry"
            );
          }

          return res;
        }),
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.addWord"],
      },
    },
    editWord: {
      mutation: ({
        id,
        updates,
      }: {
        id: string;
        updates: Partial<
          Omit<
            SelectDictionaryEntry,
            | "id"
            | "created_at"
            | "created_at_timestamp_ms"
            | "updated_at"
            | "updated_at_timestamp_ms"
          >
        >;
      }): Promise<SelectDictionaryEntry> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();
          const now = new Date();

          // Always bump updated_at, even if no other fields are provided --
          // matches the current behavior of the raw-SQL implementation this
          // replaced (no "No fields to update" guard exists for this mutation).
          const setValues: Partial<InsertDictionaryEntry> = {
            updated_at: now.toISOString(),
            updated_at_timestamp_ms: now.getTime(),
          };

          if ("word" in updates && updates.word !== undefined) {
            setValues.word = updates.word;
          }
          if ("translation" in updates && updates.translation !== undefined) {
            setValues.translation = updates.translation;
          }
          if ("definition" in updates && updates.definition !== undefined) {
            setValues.definition = updates.definition;
          }
          if ("type" in updates && updates.type !== undefined) {
            setValues.type = updates.type;
          }
          if ("root" in updates && updates.root !== undefined) {
            setValues.root = updates.root;
          }
          if ("tags" in updates && updates.tags !== undefined) {
            setValues.tags = updates.tags;
          }
          if ("antonyms" in updates && updates.antonyms !== undefined) {
            setValues.antonyms = updates.antonyms;
          }
          if ("examples" in updates && updates.examples !== undefined) {
            setValues.examples = updates.examples;
          }
          if ("morphology" in updates && updates.morphology !== undefined) {
            setValues.morphology = updates.morphology;
          }

          const [res] = await drizzleDb
            .update(dictionaryEntries)
            .set(setValues)
            .where(eq(dictionaryEntries.id, id))
            .returning();

          if (!res) {
            throw new Error(`Dictionary entry not found: ${id}`);
          }

          return res;
        }),
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.editWord"],
      },
    },
    delete: {
      mutation: ({ id }: { id: string }): Promise<SelectDictionaryEntry> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();

          const [res] = await drizzleDb
            .select()
            .from(dictionaryEntries)
            .where(eq(dictionaryEntries.id, id))
            .limit(1);

          if (!res) {
            throw new Error(`Dictionary entry not found: ${id}`);
          }

          // Explicitly delete flashcards since sync-wasm doesn't support
          // ON DELETE CASCADE (foreign key actions other than NO ACTION)
          await drizzleDb
            .delete(flashcards)
            .where(eq(flashcards.dictionary_entry_id, id));

          await drizzleDb
            .delete(dictionaryEntries)
            .where(eq(dictionaryEntries.id, id));

          return res;
        }),
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.delete"],
      },
    },
    maxUpdatedAt: {
      query: async (): Promise<number | null> => {
        const drizzleDb = await getDb();

        const [res] = await drizzleDb
          .select({ max_ts: max(dictionaryEntries.updated_at_timestamp_ms) })
          .from(dictionaryEntries);

        return res?.max_ts ?? null;
      },
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.maxUpdatedAt"],
      },
    },
  }) satisfies Record<string, TableOperation>;
