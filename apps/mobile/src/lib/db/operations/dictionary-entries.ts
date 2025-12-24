/**
 * Dictionary entries database operations for mobile app.
 */

import {
  SelectDictionaryEntry,
  RawDictionaryEntry,
  InsertDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import {
  convertRawDictionaryEntryToSelect,
  generateId,
  type TableOperation,
} from "@bahar/db-operations";
import { ensureDb } from "..";

export const dictionaryEntriesTable = {
  entry: {
    query: async ({ id }: { id: string }): Promise<SelectDictionaryEntry | null> => {
      const db = await ensureDb();

      const raw = await db
        .prepare<RawDictionaryEntry>(
          `SELECT * FROM dictionary_entries WHERE id = ?;`,
        )
        .get([id]);

      if (!raw) return null;

      const result = convertRawDictionaryEntryToSelect(raw);
      if (!result.ok) {
        console.warn(`Failed to parse dictionary entry ${id}:`, result.error);
        return null;
      }

      return result.value;
    },
    cacheOptions: {
      queryKey: ["turso.dictionary-entries.entry"] as const,
    },
  },

  addWord: {
    mutation: async ({
      entry,
    }: {
      entry: Omit<InsertDictionaryEntry, "id" | "created_at" | "updated_at">;
    }): Promise<SelectDictionaryEntry> => {
      const db = await ensureDb();
      const id = generateId();
      const now = new Date();
      const timestamp = now.toISOString();
      const timestampMs = now.getTime();

      await db
        .prepare(
          `INSERT INTO dictionary_entries (
          id, word, translation, definition, type, root, tags, antonyms, examples, morphology,
          created_at, created_at_timestamp_ms, updated_at, updated_at_timestamp_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run([
          id,
          entry.word,
          entry.translation,
          entry.definition ?? null,
          entry.type ?? null,
          entry.root ? JSON.stringify(entry.root) : null,
          entry.tags ? JSON.stringify(entry.tags) : null,
          entry.antonyms ? JSON.stringify(entry.antonyms) : null,
          entry.examples ? JSON.stringify(entry.examples) : null,
          entry.morphology ? JSON.stringify(entry.morphology) : null,
          timestamp,
          timestampMs,
          timestamp,
          timestampMs,
        ]);

      const raw = await db
        .prepare<RawDictionaryEntry>(
          `SELECT * FROM dictionary_entries WHERE id = ?;`,
        )
        .get([id]);

      if (!raw) {
        throw new Error(`Failed to retrieve newly created dictionary entry: ${id}`);
      }

      const result = convertRawDictionaryEntryToSelect(raw);
      if (!result.ok) {
        throw new Error(`Failed to parse newly created entry: ${JSON.stringify(result.error)}`);
      }

      return result.value;
    },
    cacheOptions: {
      queryKey: ["turso.dictionary-entries.add-word"] as const,
    },
  },

  editWord: {
    mutation: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<
        Omit<InsertDictionaryEntry, "id" | "created_at" | "created_at_timestamp_ms">
      >;
    }): Promise<SelectDictionaryEntry> => {
      const db = await ensureDb();
      const now = new Date();

      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (updates.word !== undefined) {
        setClauses.push("word = ?");
        params.push(updates.word);
      }
      if (updates.translation !== undefined) {
        setClauses.push("translation = ?");
        params.push(updates.translation);
      }
      if (updates.definition !== undefined) {
        setClauses.push("definition = ?");
        params.push(updates.definition);
      }
      if (updates.type !== undefined) {
        setClauses.push("type = ?");
        params.push(updates.type);
      }
      if (updates.root !== undefined) {
        setClauses.push("root = ?");
        params.push(updates.root ? JSON.stringify(updates.root) : null);
      }
      if (updates.tags !== undefined) {
        setClauses.push("tags = ?");
        params.push(updates.tags ? JSON.stringify(updates.tags) : null);
      }
      if (updates.antonyms !== undefined) {
        setClauses.push("antonyms = ?");
        params.push(updates.antonyms ? JSON.stringify(updates.antonyms) : null);
      }
      if (updates.examples !== undefined) {
        setClauses.push("examples = ?");
        params.push(updates.examples ? JSON.stringify(updates.examples) : null);
      }
      if (updates.morphology !== undefined) {
        setClauses.push("morphology = ?");
        params.push(updates.morphology ? JSON.stringify(updates.morphology) : null);
      }

      // Always update the updated_at timestamp
      setClauses.push("updated_at = ?");
      params.push(now.toISOString());
      setClauses.push("updated_at_timestamp_ms = ?");
      params.push(now.getTime());

      params.push(id);

      await db
        .prepare(
          `UPDATE dictionary_entries SET ${setClauses.join(", ")} WHERE id = ?;`,
        )
        .run(params);

      const raw = await db
        .prepare<RawDictionaryEntry>(
          `SELECT * FROM dictionary_entries WHERE id = ?;`,
        )
        .get([id]);

      if (!raw) {
        throw new Error(`Dictionary entry not found: ${id}`);
      }

      const result = convertRawDictionaryEntryToSelect(raw);
      if (!result.ok) {
        throw new Error(`Failed to parse updated entry: ${JSON.stringify(result.error)}`);
      }

      return result.value;
    },
    cacheOptions: {
      queryKey: ["turso.dictionary-entries.edit-word"] as const,
    },
  },

  delete: {
    mutation: async ({ id }: { id: string }): Promise<SelectDictionaryEntry> => {
      const db = await ensureDb();

      const raw = await db
        .prepare<RawDictionaryEntry>(
          `SELECT * FROM dictionary_entries WHERE id = ?;`,
        )
        .get([id]);

      if (!raw) {
        throw new Error(`Dictionary entry not found: ${id}`);
      }

      const result = convertRawDictionaryEntryToSelect(raw);
      if (!result.ok) {
        throw new Error(`Failed to parse entry for deletion: ${JSON.stringify(result.error)}`);
      }

      await db.prepare(`DELETE FROM dictionary_entries WHERE id = ?;`).run([id]);

      return result.value;
    },
    cacheOptions: {
      queryKey: ["turso.dictionary-entries.delete"] as const,
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
      const db = await ensureDb();

      const raws = await db
        .prepare<RawDictionaryEntry>(
          `SELECT * FROM dictionary_entries ORDER BY created_at_timestamp_ms DESC LIMIT ? OFFSET ?;`,
        )
        .all([limit, offset]);

      return raws
        .map((raw) => {
          const result = convertRawDictionaryEntryToSelect(raw);
          if (!result.ok) {
            console.warn(`Failed to parse dictionary entry:`, result.error);
            return null;
          }
          return result.value;
        })
        .filter((entry): entry is SelectDictionaryEntry => entry !== null);
    },
    cacheOptions: {
      queryKey: ["turso.dictionary-entries.list"] as const,
    },
  },

  maxUpdatedAt: {
    query: async (): Promise<number | null> => {
      const db = await ensureDb();
      const res = await db
        .prepare<{ max_ts: number | null }>(
          "SELECT MAX(updated_at_timestamp_ms) as max_ts FROM dictionary_entries",
        )
        .get([]);
      return res?.max_ts ?? null;
    },
    cacheOptions: {
      queryKey: ["turso.dictionary-entries.max-updated-at"] as const,
    },
  },
} as const satisfies Record<string, TableOperation>;
