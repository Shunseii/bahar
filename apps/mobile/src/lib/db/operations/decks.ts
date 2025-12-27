/**
 * Decks database operations for mobile app.
 */

import { generateId, type TableOperation } from "@bahar/db-operations";
import {
  FlashcardState,
  type InsertDeck,
  type RawDeck,
  type SelectDeck,
  WORD_TYPES,
} from "@bahar/drizzle-user-db-schemas";
import { ensureDb } from "..";

/**
 * Parse deck filters from JSON string.
 */
const parseFilters = (filtersJson: string | null): SelectDeck["filters"] => {
  if (!filtersJson) return {};
  try {
    return JSON.parse(filtersJson);
  } catch {
    return {};
  }
};

/**
 * Convert raw deck to typed deck.
 */
const toSelectDeck = (raw: RawDeck): SelectDeck => {
  return {
    ...raw,
    filters: parseFilters(raw.filters),
  };
};

export const decksTable = {
  list: {
    query: async (): Promise<
      (SelectDeck & { due_count: number; total_count: number })[]
    > => {
      const db = await ensureDb();
      const now = Date.now();

      // Get all decks with their flashcard counts
      const decks = await db
        .prepare<RawDeck>("SELECT * FROM decks ORDER BY name ASC;")
        .all();

      console.log(`[decks] Found ${decks.length} decks in database`);

      const result: (SelectDeck & {
        due_count: number;
        total_count: number;
      })[] = [];

      for (const rawDeck of decks) {
        const deck = toSelectDeck(rawDeck);
        const {
          tags = [],
          types: rawTypes,
          state: rawState,
        } = deck.filters ?? {};

        const types = rawTypes?.length ? rawTypes : [...WORD_TYPES];
        const state = rawState?.length
          ? rawState
          : [
              FlashcardState.NEW,
              FlashcardState.LEARNING,
              FlashcardState.REVIEW,
              FlashcardState.RE_LEARNING,
            ];

        const directions = ["forward"];

        // Build count query
        const tagJoin = tags.length > 0 ? ", json_each(d.tags) AS jt" : "";
        const tagCondition =
          tags.length > 0
            ? ` AND jt.value IN (${tags.map(() => "?").join(", ")})`
            : "";

        const countSql = `
          SELECT
            COUNT(DISTINCT CASE WHEN f.due_timestamp_ms <= ? THEN f.id END) as due_count,
            COUNT(DISTINCT f.id) as total_count
          FROM flashcards f
          LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id${tagJoin}
          WHERE f.direction IN (${directions.map(() => "?").join(", ")})
            AND f.state IN (${state.map(() => "?").join(", ")})
            AND d.type IN (${types.map(() => "?").join(", ")})
            AND f.is_hidden = 0
            ${tagCondition}
        `;

        const countResult = await db
          .prepare<{ due_count: number; total_count: number }>(countSql)
          .get([now, ...directions, ...state, ...types, ...tags]);

        console.log(
          `[decks] Deck "${deck.name}": due=${countResult?.due_count ?? 0}, total=${countResult?.total_count ?? 0}`
        );

        result.push({
          ...deck,
          due_count: countResult?.due_count ?? 0,
          total_count: countResult?.total_count ?? 0,
        });
      }

      console.log(`[decks] Returning ${result.length} decks with counts`);
      return result;
    },
    cacheOptions: {
      queryKey: ["turso.decks.list"] as const,
    },
  },

  get: {
    query: async ({ id }: { id: string }): Promise<SelectDeck | null> => {
      const db = await ensureDb();

      const raw = await db
        .prepare<RawDeck>("SELECT * FROM decks WHERE id = ?;")
        .get([id]);

      if (!raw) return null;

      return toSelectDeck(raw);
    },
    cacheOptions: {
      queryKey: ["turso.decks.get"] as const,
    },
  },

  create: {
    mutation: async ({
      deck,
    }: {
      deck: Omit<InsertDeck, "id">;
    }): Promise<SelectDeck> => {
      const db = await ensureDb();
      const id = generateId();

      await db
        .prepare(
          `INSERT INTO decks (
          id, name, filters
        ) VALUES (?, ?, ?)`
        )
        .run([
          id,
          deck.name,
          deck.filters ? JSON.stringify(deck.filters) : null,
        ]);

      const raw = await db
        .prepare<RawDeck>("SELECT * FROM decks WHERE id = ?;")
        .get([id]);

      if (!raw) {
        throw new Error(`Failed to retrieve newly created deck: ${id}`);
      }

      return toSelectDeck(raw);
    },
    cacheOptions: {
      queryKey: ["turso.decks.create"] as const,
    },
  },

  update: {
    mutation: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<InsertDeck, "id">>;
    }): Promise<SelectDeck> => {
      const db = await ensureDb();

      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (updates.name !== undefined) {
        setClauses.push("name = ?");
        params.push(updates.name);
      }
      if (updates.filters !== undefined) {
        setClauses.push("filters = ?");
        params.push(updates.filters ? JSON.stringify(updates.filters) : null);
      }

      if (setClauses.length === 0) {
        throw new Error("No fields to update");
      }

      params.push(id);

      await db
        .prepare(`UPDATE decks SET ${setClauses.join(", ")} WHERE id = ?;`)
        .run(params);

      const raw = await db
        .prepare<RawDeck>("SELECT * FROM decks WHERE id = ?;")
        .get([id]);

      if (!raw) {
        throw new Error(`Deck not found: ${id}`);
      }

      return toSelectDeck(raw);
    },
    cacheOptions: {
      queryKey: ["turso.decks.update"] as const,
    },
  },

  delete: {
    mutation: async ({ id }: { id: string }): Promise<void> => {
      const db = await ensureDb();
      await db.prepare("DELETE FROM decks WHERE id = ?;").run([id]);
    },
    cacheOptions: {
      queryKey: ["turso.decks.delete"] as const,
    },
  },
} as const satisfies Record<string, TableOperation>;
