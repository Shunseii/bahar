import {
  buildSelectWithNestedJson,
  convertRawDictionaryEntryToSelect,
  DICTIONARY_ENTRY_COLUMNS,
} from "@bahar/db-operations";
import {
  dictionaryEntries,
  FlashcardState,
  flashcards,
  type InsertFlashcard,
  type RawFlashcard,
  type SelectDeck,
  type SelectDictionaryEntry,
  type SelectFlashcard,
  WORD_TYPES,
} from "@bahar/drizzle-user-db-schemas";
import { createScheduler } from "@bahar/fsrs";
import * as Sentry from "@sentry/react";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { type Card, Rating, type ReviewLog } from "ts-fsrs";
import { api } from "../../api";
import { ensureDb, getDrizzleDb } from "..";
import type { TableOperation } from "./types";

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
      } = { showReverse: false }
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
          whereConditions.push("f.due_timestamp_ms > ?");
          params.push(backlogThresholdMs);
        } else if (queue === "backlog") {
          whereConditions.push("f.due_timestamp_ms <= ?");
          params.push(backlogThresholdMs);
        }

        whereConditions.push(
          `f.direction IN (${directions.map(() => "?").join(", ")})`
        );
        params.push(...directions);

        whereConditions.push(`f.state IN (${state.map(() => "?").join(", ")})`);
        params.push(...state);

        whereConditions.push(`d.type IN (${types.map(() => "?").join(", ")})`);
        params.push(...types);

        whereConditions.push("f.is_hidden = 0");

        const whereClause = whereConditions.join(" AND ");

        // When tags are specified, use JOIN with json_each to filter
        const tagJoin = tags.length > 0 ? ", json_each(d.tags) AS jt" : "";
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
            const result = convertRawDictionaryEntryToSelect(
              JSON.parse(raw.dictionary_entry)
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
                }
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          .prepare("SELECT * FROM flashcards WHERE id = ?;")
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
        if (
          "learning_steps" in updates &&
          updates.learning_steps !== undefined
        ) {
          setClauses.push("learning_steps = ?");
          params.push(updates.learning_steps);
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
            `UPDATE flashcards SET ${setClauses.join(", ")} WHERE id = ?;`
          )
          .run(params);

        const res: RawFlashcard | undefined = await db
          .prepare("SELECT * FROM flashcards WHERE id = ?;")
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
           WHERE dictionary_entry_id = ? AND direction = ?;`
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
            "SELECT * FROM flashcards WHERE dictionary_entry_id = ? AND direction = ?;"
          )
          .get([dictionary_entry_id, direction]);

        if (!res) {
          throw new Error(
            `Flashcard not found for dictionary entry: ${dictionary_entry_id}, direction: ${direction}`
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

  findByEntryId: {
    query: async (entryId: string): Promise<SelectFlashcard[]> => {
      const db = await ensureDb();

      const rows: RawFlashcard[] = await db
        .prepare("SELECT * FROM flashcards WHERE dictionary_entry_id = ?;")
        .all([entryId]);

      return rows.map((res) => ({
        ...res,
        direction: (res.direction ?? "forward") as SelectFlashcard["direction"],
        is_hidden: Boolean(res.is_hidden),
      }));
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.findByEntryId"] as const,
    },
  },

  findByEntryAndDirection: {
    query: async ({
      dictionaryEntryId,
      direction,
    }: {
      dictionaryEntryId: string;
      direction: string;
    }): Promise<{ data: SelectFlashcard | null }> => {
      const db = await ensureDb();

      const res: RawFlashcard | undefined = await db
        .prepare(
          "SELECT * FROM flashcards WHERE dictionary_entry_id = ? AND direction = ?;"
        )
        .get([dictionaryEntryId, direction]);

      if (!res) return { data: null };

      return {
        data: {
          ...res,
          direction: (res.direction ??
            "forward") as SelectFlashcard["direction"],
          is_hidden: Boolean(res.is_hidden),
        },
      };
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.findByEntryAndDirection"] as const,
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
          `f.direction IN (${directions.map(() => "?").join(", ")})`
        );
        baseParams.push(...directions);

        baseConditions.push(`f.state IN (${state.map(() => "?").join(", ")})`);
        baseParams.push(...state);

        baseConditions.push(`d.type IN (${types.map(() => "?").join(", ")})`);
        baseParams.push(...types);

        baseConditions.push("f.is_hidden = 0");

        const baseWhereClause = baseConditions.join(" AND ");

        // Tag filtering
        const tagJoin = tags.length > 0 ? ", json_each(d.tags) AS jt" : "";
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
    async *generator({
      showReverse = false,
      filters,
      backlogThresholdDays = DEFAULT_BACKLOG_THRESHOLD_DAYS,
    }: {
      showReverse?: boolean;
      filters?: SelectDeck["filters"];
      backlogThresholdDays?: number;
    } = {}): AsyncGenerator<{ cleared: number; total: number }> {
      await ensureDb();
      const drizzleDb = getDrizzleDb();
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

      const directions: SelectFlashcard["direction"][] = showReverse
        ? ["forward", "reverse"]
        : ["forward"];

      const conditions = [
        lte(flashcards.due_timestamp_ms, backlogThresholdMs),
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

      const backlogCards = await drizzleDb
        .selectDistinct({
          id: flashcards.id,
          dictionary_entry_id: flashcards.dictionary_entry_id,
          difficulty: flashcards.difficulty,
          due: flashcards.due,
          due_timestamp_ms: flashcards.due_timestamp_ms,
          elapsed_days: flashcards.elapsed_days,
          lapses: flashcards.lapses,
          last_review: flashcards.last_review,
          last_review_timestamp_ms: flashcards.last_review_timestamp_ms,
          learning_steps: flashcards.learning_steps,
          reps: flashcards.reps,
          scheduled_days: flashcards.scheduled_days,
          stability: flashcards.stability,
          state: flashcards.state,
          direction: flashcards.direction,
          is_hidden: flashcards.is_hidden,
        })
        .from(flashcards)
        .leftJoin(
          dictionaryEntries,
          eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
        )
        .where(and(...conditions));

      const total = backlogCards.length;

      if (total === 0) {
        return;
      }

      const f = createScheduler();
      const nowDate = new Date();
      const revlogEntries: {
        log: ReviewLog;
        direction: SelectFlashcard["direction"];
        dictionary_entry_id: string;
      }[] = [];

      let committed = false;
      await drizzleDb.run(sql`BEGIN TRANSACTION`);
      try {
        for (let i = 0; i < backlogCards.length; i++) {
          const row = backlogCards[i];
          const card: Card = {
            due: new Date(row.due),
            stability: row.stability ?? 0,
            difficulty: row.difficulty ?? 0,
            elapsed_days: row.elapsed_days ?? 0,
            scheduled_days: row.scheduled_days ?? 0,
            reps: row.reps ?? 0,
            lapses: row.lapses ?? 0,
            state: row.state ?? FlashcardState.NEW,
            learning_steps: row.learning_steps ?? 0,
            last_review: row.last_review
              ? new Date(row.last_review)
              : undefined,
          };

          const scheduling = f.repeat(card, nowDate);
          const { card: newCard, log } = scheduling[Rating.Hard];

          revlogEntries.push({
            log,
            direction: row.direction,
            dictionary_entry_id: row.dictionary_entry_id,
          });

          await drizzleDb
            .update(flashcards)
            .set({
              due: newCard.due.toISOString(),
              due_timestamp_ms: newCard.due.getTime(),
              last_review: newCard.last_review?.toISOString() ?? null,
              last_review_timestamp_ms: newCard.last_review?.getTime() ?? null,
              state: newCard.state,
              stability: newCard.stability,
              difficulty: newCard.difficulty,
              reps: newCard.reps,
              lapses: newCard.lapses,
              elapsed_days: newCard.elapsed_days,
              scheduled_days: newCard.scheduled_days,
            })
            .where(eq(flashcards.id, row.id));

          yield { cleared: i + 1, total };
        }
        await drizzleDb.run(sql`COMMIT`);
        committed = true;
      } finally {
        if (!committed) {
          await drizzleDb.run(sql`ROLLBACK`);
        }
      }

      if (revlogEntries.length > 0) {
        api.stats.revlogs.batch
          .post({
            entries: revlogEntries.map(
              ({ log, direction, dictionary_entry_id }) => ({
                ...log,
                due: log.due.toISOString(),
                review: log.review.toISOString(),
                rating: "hard",
                direction,
                dictionary_entry_id,
                source: "clear_backlog",
              })
            ),
          })
          .then(({ error }) => {
            if (error) {
              Sentry.captureException(error, {
                tags: { operation: "clearBacklog.revlogs" },
              });
            }
          })
          .catch((err) => {
            Sentry.captureException(err, {
              tags: { operation: "clearBacklog.revlogs" },
            });
          });
      }
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.clearBacklog"],
    },
  },
} as const satisfies Record<string, TableOperation>;
