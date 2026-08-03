import {
  dictionaryEntries,
  flashcards,
  type InsertDictionaryEntry,
  type SelectDictionaryEntry,
  type SelectFlashcard,
  settings,
} from "@bahar/drizzle-user-db-schemas";
import { createNewFlashcard } from "@bahar/fsrs";
import { count, desc, eq, inArray, max, sql } from "drizzle-orm";
import { nanoid } from "nanoid/non-secure";
import { enqueueDbOperation } from "../queue";
import type { NullToUndefined, TableOperation } from "../types";
import type { DrizzleDb, OperationDeps } from "./deps";

/**
 * SQLite caps the number of bound parameters per statement, so bulk operations
 * over an unbounded selection are split into fixed-size `IN (...)` chunks.
 */
const ID_CHUNK_SIZE = 100;

const chunkIds = (ids: string[]): string[][] => {
  const chunks: string[][] = [];

  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + ID_CHUNK_SIZE));
  }

  return chunks;
};

const selectEntriesByIds = async (
  drizzleDb: DrizzleDb,
  ids: string[]
): Promise<SelectDictionaryEntry[]> => {
  const rows: SelectDictionaryEntry[] = [];

  for (const chunk of chunkIds(ids)) {
    rows.push(
      ...(await drizzleDb
        .select()
        .from(dictionaryEntries)
        .where(inArray(dictionaryEntries.id, chunk)))
    );
  }

  return rows;
};

export const makeDictionaryEntriesTable = ({
  enqueue = enqueueDbOperation,
  getDb,
}: OperationDeps) =>
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
        enqueue(async () => {
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
    addWordWithFlashcards: {
      /**
       * Adds a word together with its flashcards in one `db.batch`, so an entry
       * can never be persisted without the cards that give it a review
       * schedule. Composing `addWord` then `createFlashcardPair` leaves exactly
       * that gap when the second call fails.
       *
       * Reverse-card selection matches `createFlashcardPair`: an explicit
       * `createReverse` wins, otherwise the `create_reverse_by_default`
       * setting decides.
       */
      mutation: ({
        word,
        createReverse,
      }: {
        word: Omit<
          NullToUndefined<InsertDictionaryEntry>,
          | "id"
          | "created_at"
          | "updated_at"
          | "created_at_timestamp_ms"
          | "updated_at_timestamp_ms"
        >;
        createReverse?: boolean;
      }): Promise<{
        entry: SelectDictionaryEntry;
        forward: SelectFlashcard;
        reverse: SelectFlashcard | null;
      }> =>
        enqueue(async () => {
          const drizzleDb = await getDb();

          let shouldCreateReverse = createReverse;
          if (shouldCreateReverse === undefined) {
            const [settingsRow] = await drizzleDb
              .select({ createReverse: settings.create_reverse_by_default })
              .from(settings)
              .limit(1);
            shouldCreateReverse = settingsRow?.createReverse ?? false;
          }

          const id = nanoid();
          const now = new Date();

          const directions: SelectFlashcard["direction"][] = shouldCreateReverse
            ? ["forward", "reverse"]
            : ["forward"];

          const flashcardValues = directions.map((direction) => ({
            id: nanoid(),
            is_hidden: false,
            ...createNewFlashcard(id, direction),
          }));

          const [entryRows, flashcardRows] = await drizzleDb.batch([
            drizzleDb
              .insert(dictionaryEntries)
              .values({
                id,
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
              .returning(),
            drizzleDb.insert(flashcards).values(flashcardValues).returning(),
          ]);

          const entry = entryRows[0];
          if (!entry) {
            throw new Error(
              "Failed to retrieve newly created dictionary entry"
            );
          }

          const forward = flashcardRows.find((r) => r.direction === "forward");
          if (!forward) {
            throw new Error(
              `Failed to create forward flashcard for entry: ${id}`
            );
          }

          return {
            entry,
            forward,
            reverse:
              flashcardRows.find((r) => r.direction === "reverse") ?? null,
          };
        }),
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.addWordWithFlashcards"],
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
        enqueue(async () => {
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
        enqueue(async () => {
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
    bulkDelete: {
      /**
       * Deletes several entries and their flashcards in one pass. Ids that no
       * longer exist are skipped rather than failing the whole call -- a stale
       * selection (entry deleted on another device between selecting and
       * confirming) shouldn't block deleting the rest. The returned rows are
       * the entries that were actually deleted.
       */
      mutation: ({
        ids,
      }: {
        ids: string[];
      }): Promise<SelectDictionaryEntry[]> =>
        enqueue(async () => {
          if (ids.length === 0) return [];

          const drizzleDb = await getDb();

          const rows = await selectEntriesByIds(drizzleDb, ids);

          if (rows.length === 0) return [];

          const existingIds = rows.map((row) => row.id);

          // Flashcards are deleted explicitly because sync-wasm doesn't support
          // ON DELETE CASCADE -- same reason as the single-entry delete above.
          for (const chunk of chunkIds(existingIds)) {
            await drizzleDb
              .delete(flashcards)
              .where(inArray(flashcards.dictionary_entry_id, chunk));

            await drizzleDb
              .delete(dictionaryEntries)
              .where(inArray(dictionaryEntries.id, chunk));
          }

          return rows;
        }),
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.bulkDelete"],
      },
    },
    bulkUpdateTags: {
      /**
       * Adds or removes tags across several entries at once.
       *
       * Each entry keeps its own tag list: adding is a union (existing order
       * preserved, new tags appended) and removing is a difference, so words
       * that don't have a listed tag are left untouched. Entries whose tags
       * come out unchanged are skipped instead of getting a pointless
       * `updated_at` bump, which would otherwise re-sort the dictionary and
       * push rows through sync for no reason.
       */
      mutation: ({
        ids,
        tags,
        action,
      }: {
        ids: string[];
        tags: string[];
        action: "add" | "remove";
      }): Promise<SelectDictionaryEntry[]> =>
        enqueue(async () => {
          if (ids.length === 0 || tags.length === 0) return [];

          const drizzleDb = await getDb();
          const now = new Date();

          const rows = await selectEntriesByIds(drizzleDb, ids);

          const updates = rows.flatMap((row) => {
            const current = row.tags ?? [];
            const next =
              action === "add"
                ? [...current, ...tags.filter((tag) => !current.includes(tag))]
                : current.filter((tag) => !tags.includes(tag));

            if (next.length === current.length) return [];

            return [{ id: row.id, tags: next.length > 0 ? next : null }];
          });

          if (updates.length === 0) return [];

          const updated: SelectDictionaryEntry[] = [];

          for (const update of updates) {
            const [res] = await drizzleDb
              .update(dictionaryEntries)
              .set({
                tags: update.tags,
                updated_at: now.toISOString(),
                updated_at_timestamp_ms: now.getTime(),
              })
              .where(eq(dictionaryEntries.id, update.id))
              .returning();

            if (res) updated.push(res);
          }

          return updated;
        }),
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.bulkUpdateTags"],
      },
    },
    tagsForEntries: {
      /**
       * Tags present on the given entries, with the number of those entries
       * carrying each tag. Drives the bulk "remove tags" picker, which only
       * lists tags the selection actually has.
       */
      query: async ({
        ids,
      }: {
        ids: string[];
      }): Promise<{ tag: string; count: number }[]> => {
        if (ids.length === 0) return [];

        const drizzleDb = await getDb();

        const rows = await selectEntriesByIds(drizzleDb, ids);

        const counts = new Map<string, number>();

        for (const row of rows) {
          // A tag repeated within one entry still counts once for that entry.
          for (const tag of new Set(row.tags ?? [])) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
        }

        return [...counts.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
      },
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.tagsForEntries"],
      },
    },
    count: {
      /**
       * How many entries the dictionary holds, ignoring any search or filter.
       * Bulk delete compares its selection against this to tell "delete these
       * 40" from "delete everything you have", which is worth a second look
       * before it happens.
       */
      query: async (): Promise<number> => {
        const drizzleDb = await getDb();

        const [res] = await drizzleDb
          .select({ total: count() })
          .from(dictionaryEntries);

        return res?.total ?? 0;
      },
      cacheOptions: {
        queryKey: ["turso.dictionaryEntries.count"],
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
        queryKey: ["turso.dictionaryEntries.entriesByIds"],
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
        queryKey: ["turso.dictionaryEntries.list"],
      },
    },
  }) satisfies Record<string, TableOperation>;
