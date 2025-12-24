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
import { fsrs, Rating, Card } from "ts-fsrs";

/**
 * The threshold after which the UI won't display the
 * exact number of flashcards to review, to not overwhelm
 * the user when they have a lot.
 */
export const FLASHCARD_LIMIT = 100;

/**
 * Default number of days after which a due card is considered
 * part of the backlog queue instead of the regular queue.
 */
export const DEFAULT_BACKLOG_THRESHOLD_DAYS = 7;

/**
 * Converts days to milliseconds.
 */
const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

export type FlashcardWithDictionaryEntry = SelectFlashcard & {
  dictionary_entry: SelectDictionaryEntry;
};

export type FlashcardQueue = "regular" | "backlog" | "all";

export const flashcardsTable = {
  today: {
    query: async (
      {
        showReverse,
        filters,
        queue = "all",
        backlogThresholdDays = DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }: {
        showReverse?: boolean;
        filters?: SelectDeck["filters"];
        queue?: FlashcardQueue;
        backlogThresholdDays?: number;
      } = { showReverse: false },
    ): Promise<FlashcardWithDictionaryEntry[]> => {
      try {
        const db = await ensureDb();
        const now = Date.now();
        const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

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

        if (queue === "regular") {
          // Regular queue: due but not past the backlog threshold
          whereConditions.push("f.due_timestamp_ms > ?");
          params.push(backlogThresholdMs);
        } else if (queue === "backlog") {
          // Backlog queue: due and past the backlog threshold
          whereConditions.push("f.due_timestamp_ms <= ?");
          params.push(backlogThresholdMs);
        }

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

  /**
   * Get counts for both regular and backlog queues.
   * Useful for displaying queue sizes in the UI.
   */
  counts: {
    query: async ({
      showReverse = false,
      filters,
      backlogThresholdDays = DEFAULT_BACKLOG_THRESHOLD_DAYS,
    }: {
      showReverse?: boolean;
      filters?: SelectDeck["filters"];
      backlogThresholdDays?: number;
    } = {}): Promise<{ regular: number; backlog: number; total: number }> => {
      try {
        const db = await ensureDb();
        const now = Date.now();
        const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

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

        const baseConditions: string[] = [];
        const baseParams: unknown[] = [];

        baseConditions.push(
          `f.direction IN (${directions.map(() => "?").join(", ")})`,
        );
        baseParams.push(...directions);

        baseConditions.push(`f.state IN (${state.map(() => "?").join(", ")})`);
        baseParams.push(...state);

        baseConditions.push(`d.type IN (${types.map(() => "?").join(", ")})`);
        baseParams.push(...types);

        baseConditions.push("f.is_hidden = 0");

        const baseWhereClause = baseConditions.join(" AND ");

        // Tag filtering
        const tagJoin = tags.length > 0 ? `, json_each(d.tags) AS jt` : "";
        const tagCondition =
          tags.length > 0
            ? ` AND jt.value IN (${tags.map(() => "?").join(", ")})`
            : "";
        const tagParams = tags.length > 0 ? tags : [];

        // Count regular queue (due but not past threshold)
        const regularSql = `
          SELECT COUNT(DISTINCT f.id) as count
          FROM flashcards f
          LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id${tagJoin}
          WHERE f.due_timestamp_ms <= ? AND f.due_timestamp_ms > ? AND ${baseWhereClause}${tagCondition}
        `;
        const regularResult: { count: number } = await db
          .prepare(regularSql)
          .get([now, backlogThresholdMs, ...baseParams, ...tagParams]);

        // Count backlog queue (past threshold)
        const backlogSql = `
          SELECT COUNT(DISTINCT f.id) as count
          FROM flashcards f
          LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id${tagJoin}
          WHERE f.due_timestamp_ms <= ? AND ${baseWhereClause}${tagCondition}
        `;
        const backlogResult: { count: number } = await db
          .prepare(backlogSql)
          .get([backlogThresholdMs, ...baseParams, ...tagParams]);

        const regular = regularResult?.count ?? 0;
        const backlog = backlogResult?.count ?? 0;

        return {
          regular,
          backlog,
          total: regular + backlog,
        };
      } catch (err) {
        console.error("Error in flashcardsTable.counts", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.counts"],
    },
  },

  /**
   * Clear backlog by grading all backlog cards as "Hard".
   * This reschedules them without fully resetting progress.
   * Uses an async generator for progress tracking.
   */
  clearBacklog: {
    generator: async function* ({
      showReverse = false,
      filters,
      backlogThresholdDays = DEFAULT_BACKLOG_THRESHOLD_DAYS,
    }: {
      showReverse?: boolean;
      filters?: SelectDeck["filters"];
      backlogThresholdDays?: number;
    } = {}): AsyncGenerator<{ cleared: number; total: number }> {
      const db = await ensureDb();
      const now = Date.now();
      const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

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

      // Build query to get backlog cards
      const whereConditions: string[] = ["f.due_timestamp_ms <= ?"];
      const params: unknown[] = [backlogThresholdMs];

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

      const tagJoin = tags.length > 0 ? `, json_each(d.tags) AS jt` : "";
      const tagCondition =
        tags.length > 0
          ? ` AND jt.value IN (${tags.map(() => "?").join(", ")})`
          : "";
      const tagParams = tags.length > 0 ? tags : [];

      const sql = `SELECT DISTINCT f.*
        FROM flashcards f
        LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id${tagJoin}
        WHERE ${whereClause}${tagCondition}`;

      const backlogCards: RawFlashcard[] = await db
        .prepare(sql)
        .all([...params, ...tagParams]);

      const total = backlogCards.length;

      if (total === 0) {
        return;
      }

      // Grade each card as Hard using FSRS
      const f = fsrs({ enable_fuzz: true });
      const nowDate = new Date();

      await db.exec("BEGIN TRANSACTION");
      try {
        for (let i = 0; i < backlogCards.length; i++) {
          const rawCard = backlogCards[i];
          const card: Card = {
            due: new Date(rawCard.due),
            stability: rawCard.stability ?? 0,
            difficulty: rawCard.difficulty ?? 0,
            elapsed_days: rawCard.elapsed_days ?? 0,
            scheduled_days: rawCard.scheduled_days ?? 0,
            reps: rawCard.reps ?? 0,
            lapses: rawCard.lapses ?? 0,
            state: rawCard.state ?? FlashcardState.NEW,
            last_review: rawCard.last_review
              ? new Date(rawCard.last_review)
              : undefined,
          };

          const scheduling = f.repeat(card, nowDate);
          const newCard = scheduling[Rating.Hard].card;

          await db
            .prepare(
              `UPDATE flashcards SET
                due = ?,
                due_timestamp_ms = ?,
                last_review = ?,
                last_review_timestamp_ms = ?,
                state = ?,
                stability = ?,
                difficulty = ?,
                reps = ?,
                lapses = ?,
                elapsed_days = ?,
                scheduled_days = ?
              WHERE id = ?`,
            )
            .run([
              newCard.due.toISOString(),
              newCard.due.getTime(),
              newCard.last_review?.toISOString() ?? null,
              newCard.last_review?.getTime() ?? null,
              newCard.state,
              newCard.stability,
              newCard.difficulty,
              newCard.reps,
              newCard.lapses,
              newCard.elapsed_days,
              newCard.scheduled_days,
              rawCard.id,
            ]);

          yield { cleared: i + 1, total };
        }
        await db.exec("COMMIT");
      } catch (err) {
        await db.exec("ROLLBACK");
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.clearBacklog"],
    },
  },
} as const satisfies Record<string, TableOperation>;
