import {
  SelectDictionaryEntry,
  RawDictionaryEntry,
  InsertDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { ensureDb } from "..";
import { nanoid } from "nanoid";
import {
  convertRawDictionaryEntryToSelect,
  type ConvertDictionaryEntryError,
} from "@bahar/db-operations";
import { NullToUndefined } from "../../utils";
import { TableOperation } from "./types";

class DictionaryEntryParseError extends Error {
  constructor(public details: ConvertDictionaryEntryError) {
    super(
      `Failed to parse dictionary entry "${details.word}" (${details.entryId}): field "${details.field}" - ${details.reason}`,
    );
    this.name = "DictionaryEntryParseError";
  }
}

export const dictionaryEntriesTable = {
  entry: {
    query: async (id: string): Promise<SelectDictionaryEntry> => {
      try {
        const db = await ensureDb();
        const res: RawDictionaryEntry | undefined = await db
          .prepare(`SELECT * FROM dictionary_entries WHERE id = ?`)
          .get([id]);

        if (!res) {
          throw new Error(`Dictionary entry not found: ${id}`);
        }

        const result = convertRawDictionaryEntryToSelect(res);
        if (!result.ok) {
          throw new DictionaryEntryParseError(result.error);
        }
        return result.value;
      } catch (err) {
        console.error("Error in dictionaryEntriesTable.entry", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.dictionaryEntries.entry.query"],
    },
  },
  tags: {
    query: async (
      searchTerm: string,
    ): Promise<{ tag: string; count: number }[]> => {
      try {
        const db = await ensureDb();

        const res: { tag: string; count: number }[] = await db
          .prepare(
            `SELECT value as tag, COUNT(*) as count
             FROM dictionary_entries, json_each(tags)
             WHERE value IS NOT NULL AND value LIKE '%' || ? || '%'
             GROUP BY value
             ORDER BY count DESC;`,
          )
          .all([searchTerm]);

        return res;
      } catch (err) {
        console.error("Error in dictionaryEntriesTable.tags", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.dictionaryEntries.tags.query"],
    },
  },
  addWord: {
    mutation: async ({
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
    }): Promise<SelectDictionaryEntry> => {
      try {
        const db = await ensureDb();
        const id = nanoid();
        const now = new Date();
        const createdAt = now.toISOString();
        const createdAtTimestampMs = now.getTime();

        await db
          .prepare(
            `INSERT INTO dictionary_entries (
            id, word, translation, definition, type, root, tags, antonyms, examples, morphology,
            created_at, created_at_timestamp_ms, updated_at, updated_at_timestamp_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          )
          .run([
            id,
            word.word,
            word.translation,
            word.definition ?? null,
            word.type,
            word.root ? JSON.stringify(word.root) : null,
            word.tags ? JSON.stringify(word.tags) : null,
            word.antonyms ? JSON.stringify(word.antonyms) : null,
            word.examples ? JSON.stringify(word.examples) : null,
            word.morphology ? JSON.stringify(word.morphology) : null,
            createdAt,
            createdAtTimestampMs,
            createdAt,
            createdAtTimestampMs,
          ]);

        const res: RawDictionaryEntry | undefined = await db
          .prepare(`SELECT * FROM dictionary_entries WHERE id = ?;`)
          .get([id]);

        if (!res) {
          throw new Error(
            `Failed to retrieve newly created dictionary entry: ${id}`,
          );
        }

        const result = convertRawDictionaryEntryToSelect(res);
        if (!result.ok) {
          throw new DictionaryEntryParseError(result.error);
        }
        return result.value;
      } catch (err) {
        console.error("Error in dictionaryEntriesTable.addWord", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.dictionaryEntries.addWord"],
    },
  },
  editWord: {
    mutation: async ({
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
    }): Promise<SelectDictionaryEntry> => {
      try {
        const db = await ensureDb();
        const now = new Date();
        const updatedAt = now.toISOString();
        const updatedAtTimestampMs = now.getTime();

        const setClauses: string[] = [];
        const params: unknown[] = [];

        if ("word" in updates && updates.word !== undefined) {
          setClauses.push("word = ?");
          params.push(updates.word);
        }
        if ("translation" in updates && updates.translation !== undefined) {
          setClauses.push("translation = ?");
          params.push(updates.translation);
        }
        if ("definition" in updates && updates.definition !== undefined) {
          setClauses.push("definition = ?");
          params.push(updates.definition ?? null);
        }
        if ("type" in updates && updates.type !== undefined) {
          setClauses.push("type = ?");
          params.push(updates.type);
        }
        if ("root" in updates && updates.root !== undefined) {
          setClauses.push("root = ?");
          params.push(
            updates.root !== null ? JSON.stringify(updates.root) : null,
          );
        }
        if ("tags" in updates && updates.tags !== undefined) {
          setClauses.push("tags = ?");
          params.push(
            updates.tags !== null ? JSON.stringify(updates.tags) : null,
          );
        }
        if ("antonyms" in updates && updates.antonyms !== undefined) {
          setClauses.push("antonyms = ?");
          params.push(
            updates.antonyms !== null ? JSON.stringify(updates.antonyms) : null,
          );
        }
        if ("examples" in updates && updates.examples !== undefined) {
          setClauses.push("examples = ?");
          params.push(
            updates.examples !== null ? JSON.stringify(updates.examples) : null,
          );
        }
        if ("morphology" in updates && updates.morphology !== undefined) {
          setClauses.push("morphology = ?");
          params.push(
            updates.morphology !== null
              ? JSON.stringify(updates.morphology)
              : null,
          );
        }

        // Always update the updated_at fields
        setClauses.push("updated_at = ?");
        params.push(updatedAt);
        setClauses.push("updated_at_timestamp_ms = ?");
        params.push(updatedAtTimestampMs);

        // Add id for the WHERE clause
        params.push(id);

        await db
          .prepare(
            `UPDATE dictionary_entries SET ${setClauses.join(
              ", ",
            )} WHERE id = ?;`,
          )
          .run(params);

        const res: RawDictionaryEntry | undefined = await db
          .prepare(`SELECT * FROM dictionary_entries WHERE id = ?;`)
          .get([id]);

        if (!res) {
          throw new Error(`Dictionary entry not found: ${id}`);
        }

        const result = convertRawDictionaryEntryToSelect(res);
        if (!result.ok) {
          throw new DictionaryEntryParseError(result.error);
        }
        return result.value;
      } catch (err) {
        console.error("Error in dictionaryEntriesTable.editWord", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.dictionaryEntries.editWord"],
    },
  },
  delete: {
    mutation: async ({
      id,
    }: {
      id: string;
    }): Promise<SelectDictionaryEntry> => {
      try {
        const db = await ensureDb();

        const res: RawDictionaryEntry | undefined = await db
          .prepare("SELECT * FROM dictionary_entries WHERE id = ?;")
          .get([id]);

        if (!res) {
          throw new Error(`Dictionary entry not found: ${id}`);
        }

        await db
          .prepare(`DELETE FROM dictionary_entries WHERE id = ?;`)
          .run([id]);

        const result = convertRawDictionaryEntryToSelect(res);
        if (!result.ok) {
          throw new DictionaryEntryParseError(result.error);
        }
        return result.value;
      } catch (err) {
        console.error("Error in dictionaryEntriesTable.delete", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.dictionaryEntries.delete"],
    },
  },
  maxUpdatedAt: {
    query: async (): Promise<number | null> => {
      const db = await ensureDb();
      const res: { max_ts: number | null } | undefined = await db
        .prepare(
          "SELECT MAX(updated_at_timestamp_ms) as max_ts FROM dictionary_entries",
        )
        .get([]);
      return res?.max_ts ?? null;
    },
    cacheOptions: {
      queryKey: ["turso.dictionaryEntries.maxUpdatedAt"],
    },
  },
} satisfies Record<string, TableOperation>;
