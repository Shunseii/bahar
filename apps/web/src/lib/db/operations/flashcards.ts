import {
  SelectFlashcard,
  RawFlashcard,
  SelectDeck,
  FlashcardState,
  SelectDictionaryEntry,
  InsertFlashcard,
  WORD_TYPES,
} from "@bahar/drizzle-user-db-schemas";
import { ensureDb } from "..";
import { nanoid } from "nanoid";
import {
  buildSelectWithNestedJson,
  convertRawDictionaryEntryToSelectDictionaryEntry,
  DICTIONARY_ENTRY_COLUMNS,
} from "../utils";
import { TableOperation } from "./types";
import * as Sentry from "@sentry/react";
import { debounce } from "@tanstack/pacer";

const DEBOUNCED_DELAY_MS = 2 * 1000;

const debouncedPush = debounce(
  async () => {
    try {
      const db = await ensureDb();
      await db.push();
    } catch (error) {
      Sentry.logger.warn("Debounced push failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  { wait: DEBOUNCED_DELAY_MS },
);

/**
 * The threshold after which the UI won't display the
 * exact number of flashcards to review, to not overwhelm
 * the user when they have a lot.
 */
export const FLASHCARD_LIMIT = 100;

export type FlashcardWithDictionaryEntry = SelectFlashcard & {
  dictionary_entry: SelectDictionaryEntry;
};

export const flashcardsTable = {
  today: {
    query: async (
      {
        showReverse,
        filters,
      }: {
        showReverse?: boolean;
        filters?: SelectDeck["filters"];
      } = { showReverse: false },
    ): Promise<FlashcardWithDictionaryEntry[]> => {
      try {
        const db = await ensureDb();
        const now = Date.now();

        const { tags = [], types: rawTypes, state: rawState } = filters ?? {};

        const types = rawTypes?.length ? rawTypes : [...WORD_TYPES];
        const state = rawState?.length
          ? rawState
          : [
              FlashcardState.NEW,
              FlashcardState.LEARNING,
              FlashcardState.REVIEW,
              FlashcardState.RE_LEARNING,
            ];

        const directions = showReverse ? ["forward", "reverse"] : ["forward"];

        const whereConditions: string[] = ["f.due_timestamp_ms <= ?"];
        const params: unknown[] = [now];

        whereConditions.push(
          `f.direction IN (${directions.map(() => "?").join(", ")})`,
        );
        params.push(...directions);

        whereConditions.push(`f.state IN (${state.map(() => "?").join(", ")})`);
        params.push(...state);

        whereConditions.push(`d.type IN (${types.map(() => "?").join(", ")})`);
        params.push(...types);

        whereConditions.push("f.is_hidden = 0");

        const whereClause = whereConditions.join(" AND ");

        // When tags are specified, use JOIN with json_each to filter
        const tagJoin = tags.length > 0 ? `, json_each(d.tags) AS jt` : "";
        const tagCondition =
          tags.length > 0
            ? ` AND jt.value IN (${tags.map(() => "?").join(", ")})`
            : "";
        const tagParams = tags.length > 0 ? tags : [];

        const nestedDictionary = buildSelectWithNestedJson({
          columns: DICTIONARY_ENTRY_COLUMNS,
          jsonObjectAlias: "dictionary_entry",
          tableAlias: "d",
        });

        const sql = `SELECT DISTINCT f.*, ${nestedDictionary}
        FROM flashcards f
        LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id${tagJoin}
        WHERE ${whereClause}${tagCondition}
        `;

        const rawResults: (RawFlashcard & {
          dictionary_entry: string;
        })[] = await db.prepare(sql).all([...params, ...tagParams]);

        return rawResults
          ?.map((raw) => {
            const result = convertRawDictionaryEntryToSelectDictionaryEntry(
              JSON.parse(raw.dictionary_entry),
            );

            if (!result.ok) {
              Sentry.captureMessage(
                `Flashcard query: failed to parse dictionary entry for flashcard ${raw.id}`,
                {
                  level: "warning",
                  extra: {
                    flashcardId: raw.id,
                    error: result.error,
                  },
                },
              );
              return null;
            }

            return {
              ...raw,
              direction: (raw.direction ??
                "forward") as SelectFlashcard["direction"],
              is_hidden: Boolean(raw.is_hidden),
              dictionary_entry: result.value,
            };
          })
          .filter((entry) => entry !== null);
      } catch (err) {
        console.error("Error in flashcardsTable.today", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.today.query"],
    },
  },
  create: {
    mutation: async ({
      flashcard,
    }: {
      flashcard: Omit<
        InsertFlashcard,
        "id" | "last_review_timestamp_ms" | "due_timestamp_ms"
      >;
    }): Promise<SelectFlashcard> => {
      try {
        const db = await ensureDb();
        const id = nanoid();
        const dueDateMs = new Date(flashcard.due).getTime();
        const lastReviewDateMs = flashcard.last_review
          ? new Date(flashcard.last_review).getTime()
          : null;

        await db
          .prepare(
            `INSERT INTO flashcards (
          id, dictionary_entry_id, difficulty, due, due_timestamp_ms, elapsed_days,
          lapses, last_review, last_review_timestamp_ms, reps, scheduled_days, stability, state, direction, is_hidden
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run([
            id,
            flashcard.dictionary_entry_id,
            flashcard.difficulty,
            flashcard.due,
            dueDateMs,
            flashcard.elapsed_days,
            flashcard.lapses,
            flashcard.last_review,
            lastReviewDateMs,
            flashcard.reps,
            flashcard.scheduled_days,
            flashcard.stability,
            flashcard.state,
            flashcard.direction,
            0,
          ]);

        await db.push();

        const res: RawFlashcard | undefined = await db
          .prepare(`SELECT * FROM flashcards WHERE id = ?;`)
          .get([id]);

        if (!res) {
          throw new Error(`Failed to retrieve newly created flashcard: ${id}`);
        }

        return {
          ...res,
          direction: (res.direction ??
            "forward") as SelectFlashcard["direction"],
          is_hidden: Boolean(res.is_hidden),
        };
      } catch (err) {
        console.error("Error in flashcardsTable.create", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.create"],
    },
  },

  update: {
    mutation: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<RawFlashcard, "id" | "dictionary_entry_id">>;
    }): Promise<SelectFlashcard> => {
      try {
        const db = await ensureDb();

        const setClauses: string[] = [];
        const params: unknown[] = [];

        if ("difficulty" in updates && updates.difficulty !== undefined) {
          setClauses.push("difficulty = ?");
          params.push(updates.difficulty);
        }
        if ("due" in updates && updates.due !== undefined) {
          setClauses.push("due = ?");
          params.push(updates.due);
        }
        if (
          "due_timestamp_ms" in updates &&
          updates.due_timestamp_ms !== undefined
        ) {
          setClauses.push("due_timestamp_ms = ?");
          params.push(updates.due_timestamp_ms);
        }
        if ("elapsed_days" in updates && updates.elapsed_days !== undefined) {
          setClauses.push("elapsed_days = ?");
          params.push(updates.elapsed_days);
        }
        if ("lapses" in updates && updates.lapses !== undefined) {
          setClauses.push("lapses = ?");
          params.push(updates.lapses);
        }
        if ("last_review" in updates && updates.last_review !== undefined) {
          setClauses.push("last_review = ?");
          params.push(updates.last_review);
        }
        if (
          "last_review_timestamp_ms" in updates &&
          updates.last_review_timestamp_ms !== undefined
        ) {
          setClauses.push("last_review_timestamp_ms = ?");
          params.push(updates.last_review_timestamp_ms);
        }
        if ("reps" in updates && updates.reps !== undefined) {
          setClauses.push("reps = ?");
          params.push(updates.reps);
        }
        if (
          "scheduled_days" in updates &&
          updates.scheduled_days !== undefined
        ) {
          setClauses.push("scheduled_days = ?");
          params.push(updates.scheduled_days);
        }
        if ("stability" in updates && updates.stability !== undefined) {
          setClauses.push("stability = ?");
          params.push(updates.stability);
        }
        if ("state" in updates && updates.state !== undefined) {
          setClauses.push("state = ?");
          params.push(updates.state);
        }
        if ("is_hidden" in updates && updates.is_hidden !== undefined) {
          setClauses.push("is_hidden = ?");
          params.push(updates.is_hidden);
        }

        if (setClauses.length === 0) {
          throw new Error("No fields to update");
        }

        params.push(id);

        await db
          .prepare(
            `UPDATE flashcards SET ${setClauses.join(", ")} WHERE id = ?;`,
          )
          .run(params);

        debouncedPush();

        const res: RawFlashcard | undefined = await db
          .prepare(`SELECT * FROM flashcards WHERE id = ?;`)
          .get([id]);

        if (!res) {
          throw new Error(`Flashcard not found: ${id}`);
        }

        return {
          ...res,
          direction: (res.direction ??
            "forward") as SelectFlashcard["direction"],
          is_hidden: Boolean(res.is_hidden),
        };
      } catch (err) {
        console.error("Error in flashcardsTable.update", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.update"],
    },
  },
  reset: {
    mutation: async ({
      dictionary_entry_id,
      direction,
    }: {
      dictionary_entry_id: string;
      direction: SelectFlashcard["direction"];
    }): Promise<SelectFlashcard> => {
      try {
        const db = await ensureDb();
        const now = new Date();
        const dueDate = now.toISOString();
        const dueDateMs = now.getTime();

        await db
          .prepare(
            `UPDATE flashcards
           SET state = ?, difficulty = ?, stability = ?, reps = ?, lapses = ?,
               elapsed_days = ?, scheduled_days = ?, last_review = NULL,
               last_review_timestamp_ms = NULL, due = ?, due_timestamp_ms = ?
           WHERE dictionary_entry_id = ? AND direction = ?;`,
          )
          .run([
            FlashcardState.NEW,
            0,
            0,
            0,
            0,
            0,
            0,
            dueDate,
            dueDateMs,
            dictionary_entry_id,
            direction,
          ]);

        await db.push();

        const res: RawFlashcard | undefined = await db
          .prepare(
            `SELECT * FROM flashcards WHERE dictionary_entry_id = ? AND direction = ?;`,
          )
          .get([dictionary_entry_id, direction]);

        if (!res) {
          throw new Error(
            `Flashcard not found for dictionary entry: ${dictionary_entry_id}, direction: ${direction}`,
          );
        }

        return {
          ...res,
          direction: (res.direction ??
            "forward") as SelectFlashcard["direction"],
          is_hidden: Boolean(res.is_hidden),
        };
      } catch (err) {
        console.error("Error in flashcardsTable.reset", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.reset"],
    },
  },
} as const satisfies Record<string, TableOperation>;
