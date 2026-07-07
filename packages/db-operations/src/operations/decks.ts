import {
  decks,
  dictionaryEntries,
  FlashcardState,
  flashcards,
  type InsertDeck,
  type SelectDeck,
  WORD_TYPES,
} from "@bahar/drizzle-user-db-schemas";
import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { DEFAULT_BACKLOG_THRESHOLD_DAYS } from "../constants";
import { enqueueDbOperation } from "../queue";
import type { TableOperation } from "../types";
import type { OperationDeps } from "./deps";

/**
 * Converts days to milliseconds.
 */
const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

export const makeDecksTable = ({ getDb }: OperationDeps) =>
  ({
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
        const drizzleDb = await getDb();
        const now = Date.now();
        const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

        const decksList = await drizzleDb
          .select({ id: decks.id, name: decks.name, filters: decks.filters })
          .from(decks);

        const enrichedDecks = await Promise.all(
          decksList.map(async (deck) => {
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

            const directions: ("forward" | "reverse")[] = show_reverse
              ? ["forward", "reverse"]
              : ["forward"];

            const conditions = [
              inArray(flashcards.direction, directions),
              inArray(flashcards.state, state),
              inArray(dictionaryEntries.type, types),
              eq(flashcards.is_hidden, false),
              ...(tags.length > 0
                ? [
                    sql`EXISTS (SELECT 1 FROM json_each(${dictionaryEntries.tags}) WHERE value IN (${sql.join(
                      tags.map((t) => sql`${t}`),
                      sql`, `
                    )}))`,
                  ]
                : []),
            ];

            const [counts] = await drizzleDb
              .select({
                to_review: sql<number>`COUNT(DISTINCT CASE WHEN ${flashcards.due_timestamp_ms} <= ${now} AND ${flashcards.due_timestamp_ms} > ${backlogThresholdMs} THEN ${flashcards.id} END)`,
                to_review_backlog: sql<number>`COUNT(DISTINCT CASE WHEN ${flashcards.due_timestamp_ms} <= ${backlogThresholdMs} THEN ${flashcards.id} END)`,
                total_hits: sql<number>`COUNT(DISTINCT ${flashcards.id})`,
              })
              .from(flashcards)
              .leftJoin(
                dictionaryEntries,
                eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
              )
              .where(and(...conditions));

            return {
              ...deck,
              to_review: counts?.to_review ?? 0,
              to_review_backlog: counts?.to_review_backlog ?? 0,
              total_hits: counts?.total_hits ?? 0,
            };
          })
        );

        return enrichedDecks;
      },
      cacheOptions: {
        queryKey: ["turso.decks.list"],
      },
    },
    create: {
      mutation: ({
        deck,
      }: {
        deck: Omit<SelectDeck, "id">;
      }): Promise<SelectDeck> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();

          const [res] = await drizzleDb
            .insert(decks)
            .values({
              id: nanoid(),
              name: deck.name,
              filters: deck.filters ?? null,
            })
            .returning();

          if (!res) {
            throw new Error("Failed to retrieve newly created deck");
          }

          return res;
        }),
      cacheOptions: {
        queryKey: ["turso.decks.create"],
      },
    },
    update: {
      mutation: ({
        id,
        updates,
      }: {
        id: string;
        updates: Partial<Omit<SelectDeck, "id">>;
      }): Promise<SelectDeck> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();

          const setValues: Partial<InsertDeck> = {};

          if ("name" in updates && updates.name !== undefined) {
            setValues.name = updates.name;
          }
          if ("filters" in updates && updates.filters !== undefined) {
            setValues.filters = updates.filters;
          }

          if (Object.keys(setValues).length === 0) {
            throw new Error("No fields to update");
          }

          const [res] = await drizzleDb
            .update(decks)
            .set(setValues)
            .where(eq(decks.id, id))
            .returning();

          if (!res) {
            throw new Error(`Deck not found: ${id}`);
          }

          return res;
        }),
      cacheOptions: {
        queryKey: ["turso.decks.update"],
      },
    },
    delete: {
      mutation: ({ id }: { id: string }): Promise<{ success: boolean }> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();

          await drizzleDb.delete(decks).where(eq(decks.id, id));

          return { success: true };
        }),
      cacheOptions: {
        queryKey: ["turso.decks.delete"],
      },
    },
  }) satisfies Record<string, TableOperation>;
