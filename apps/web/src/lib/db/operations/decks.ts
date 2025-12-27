import {
  FlashcardState,
  type RawDeck,
  type SelectDeck,
  WORD_TYPES,
} from "@bahar/drizzle-user-db-schemas";
import { nanoid } from "nanoid";
import { ensureDb } from "..";
import { DEFAULT_BACKLOG_THRESHOLD_DAYS } from "./flashcards";
import type { TableOperation } from "./types";

/**
 * Converts days to milliseconds.
 */
const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

export const decksTable = {
  list: {
    query: async ({
      show_reverse,
      backlogThresholdDays = DEFAULT_BACKLOG_THRESHOLD_DAYS,
    }: {
      show_reverse?: boolean;
      backlogThresholdDays?: number;
    }): Promise<
      (SelectDeck & {
        to_review: number;
        to_review_backlog: number;
        total_hits: number;
      })[]
    > => {
      try {
        const db = await ensureDb();
        const now = Date.now();
        const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

        const rawDecks: RawDeck[] = await db
          .prepare("SELECT id, name, filters FROM decks")
          .all();

        const decks = rawDecks.map<SelectDeck>((rawDeck) => ({
          ...rawDeck,
          filters: rawDeck.filters ? JSON.parse(rawDeck.filters) : null,
        }));

        const enrichedDecks = await Promise.all(
          decks.map(async (deck) => {
            try {
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

              const directions = show_reverse
                ? ["forward", "reverse"]
                : ["forward"];

              const whereConditions: string[] = [];
              const baseParams: unknown[] = [];

              whereConditions.push(
                `f.direction IN (${directions.map(() => "?").join(", ")})`
              );
              baseParams.push(...directions);

              whereConditions.push(
                `f.state IN (${state.map(() => "?").join(", ")})`
              );
              baseParams.push(...state);

              whereConditions.push(
                `d.type IN (${types.map(() => "?").join(", ")})`
              );
              baseParams.push(...types);

              whereConditions.push("f.is_hidden = 0");

              const whereClause = whereConditions.join(" AND ");

              // When tags are specified, use JOIN with json_each to filter
              const tagJoin =
                tags.length > 0 ? ", json_each(d.tags) AS jt" : "";
              const tagCondition =
                tags.length > 0
                  ? ` AND jt.value IN (${tags.map(() => "?").join(", ")})`
                  : "";

              // Single query with conditional aggregation for all counts
              const countsSql = `
                SELECT
                  COUNT(DISTINCT CASE WHEN f.due_timestamp_ms <= ? AND f.due_timestamp_ms > ? THEN f.id END) as to_review,
                  COUNT(DISTINCT CASE WHEN f.due_timestamp_ms <= ? THEN f.id END) as to_review_backlog,
                  COUNT(DISTINCT f.id) as total_hits
                FROM flashcards f
                LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id${tagJoin}
                WHERE ${whereClause}${tagCondition}
              `;
              const counts: {
                to_review: number;
                to_review_backlog: number;
                total_hits: number;
              } = await db
                .prepare(countsSql)
                .get([
                  now,
                  backlogThresholdMs,
                  backlogThresholdMs,
                  ...baseParams,
                  ...tags,
                ]);

              return {
                ...deck,
                to_review: counts?.to_review ?? 0,
                to_review_backlog: counts?.to_review_backlog ?? 0,
                total_hits: counts?.total_hits ?? 0,
              };
            } catch (err) {
              console.error("Error processing deck", err);
              throw err;
            }
          })
        );

        return enrichedDecks;
      } catch (err) {
        console.error("Error in decksTable.list", err);

        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.decks.list"],
    },
  },
  create: {
    mutation: async ({
      deck,
    }: {
      deck: Omit<SelectDeck, "id">;
    }): Promise<SelectDeck> => {
      try {
        const db = await ensureDb();
        const id = nanoid();

        await db
          .prepare("INSERT INTO decks (id, name, filters) VALUES (?, ?, ?);")
          .run([
            id,
            deck.name,
            deck.filters ? JSON.stringify(deck.filters) : null,
          ]);

        const res: RawDeck | undefined = await db
          .prepare("SELECT * FROM decks WHERE id = ?;")
          .get([id]);

        if (!res) {
          throw new Error(`Failed to retrieve newly created deck: ${id}`);
        }

        return {
          ...res,
          filters: res.filters ? JSON.parse(res.filters) : null,
        };
      } catch (err) {
        console.error("Error in decksTable.create", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.decks.create"],
    },
  },
  update: {
    mutation: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<SelectDeck, "id">>;
    }): Promise<SelectDeck> => {
      try {
        const db = await ensureDb();

        const setClauses: string[] = [];
        const params: unknown[] = [];

        if ("name" in updates && updates.name !== undefined) {
          setClauses.push("name = ?");
          params.push(updates.name);
        }
        if ("filters" in updates && updates.filters !== undefined) {
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

        const res: RawDeck | undefined = await db
          .prepare("SELECT * FROM decks WHERE id = ?;")
          .get([id]);

        if (!res) {
          throw new Error(`Deck not found: ${id}`);
        }

        return {
          ...res,
          filters: res.filters ? JSON.parse(res.filters) : null,
        };
      } catch (err) {
        console.error("Error in decksTable.update", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.decks.update"],
    },
  },
  delete: {
    mutation: async ({ id }: { id: string }): Promise<{ success: boolean }> => {
      try {
        const db = await ensureDb();

        await db.prepare("DELETE FROM decks WHERE id = ?;").run([id]);

        return { success: true };
      } catch (err) {
        console.error("Error in decksTable.delete", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.decks.delete"],
    },
  },
} satisfies Record<string, TableOperation>;
