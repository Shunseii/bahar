import {
  dictionaryEntries,
  FlashcardState,
  flashcards,
  type InsertFlashcard,
  type SelectDeck,
  type SelectDictionaryEntry,
  type SelectFlashcard,
  WORD_TYPES,
} from "@bahar/drizzle-user-db-schemas";
import { createScheduler } from "@bahar/fsrs";
import * as Sentry from "@sentry/react";
import { and, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { type Card, Rating, type ReviewLog } from "ts-fsrs";
import { api } from "../../api";
import { ensureDb, getDrizzleDb } from "..";
import { enqueueDbOperation } from "../queue";
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
        lte(flashcards.due_timestamp_ms, now),
        ...(queue === "regular"
          ? [gt(flashcards.due_timestamp_ms, backlogThresholdMs)]
          : []),
        ...(queue === "backlog"
          ? [lte(flashcards.due_timestamp_ms, backlogThresholdMs)]
          : []),
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

      const rows = await drizzleDb
        .selectDistinct({
          id: flashcards.id,
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
          dictionary_entry: {
            id: dictionaryEntries.id,
            word: dictionaryEntries.word,
            translation: dictionaryEntries.translation,
            definition: dictionaryEntries.definition,
            type: dictionaryEntries.type,
            root: dictionaryEntries.root,
            tags: dictionaryEntries.tags,
            antonyms: dictionaryEntries.antonyms,
            examples: dictionaryEntries.examples,
            morphology: dictionaryEntries.morphology,
            created_at: dictionaryEntries.created_at,
            created_at_timestamp_ms: dictionaryEntries.created_at_timestamp_ms,
            updated_at: dictionaryEntries.updated_at,
            updated_at_timestamp_ms: dictionaryEntries.updated_at_timestamp_ms,
          },
        })
        .from(flashcards)
        .innerJoin(
          dictionaryEntries,
          eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
        )
        .where(and(...conditions));

      // dictionary_entry_id is intentionally not selected directly above --
      // its natural drizzle-generated alias for the nested dictionary_entry.id
      // path collides with it, corrupting row mapping through the custom
      // sqlite-proxy adapter. It always equals dictionary_entry.id here
      // anyway, since that's the join condition.
      return rows.map((row) => ({
        ...row,
        dictionary_entry_id: row.dictionary_entry.id,
      }));
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.today.query"],
    },
  },
  create: {
    mutation: ({
      flashcard,
    }: {
      flashcard: Omit<
        InsertFlashcard,
        "id" | "last_review_timestamp_ms" | "due_timestamp_ms"
      >;
    }): Promise<SelectFlashcard> =>
      enqueueDbOperation(async () => {
        await ensureDb();
        const drizzleDb = getDrizzleDb();

        const [res] = await drizzleDb
          .insert(flashcards)
          .values({
            id: nanoid(),
            dictionary_entry_id: flashcard.dictionary_entry_id,
            difficulty: flashcard.difficulty,
            due: flashcard.due,
            due_timestamp_ms: new Date(flashcard.due).getTime(),
            elapsed_days: flashcard.elapsed_days,
            lapses: flashcard.lapses,
            last_review: flashcard.last_review,
            last_review_timestamp_ms: flashcard.last_review
              ? new Date(flashcard.last_review).getTime()
              : null,
            reps: flashcard.reps,
            scheduled_days: flashcard.scheduled_days,
            stability: flashcard.stability,
            state: flashcard.state,
            direction: flashcard.direction,
            is_hidden: false,
          })
          .returning();

        if (!res) {
          throw new Error("Failed to retrieve newly created flashcard");
        }

        return res;
      }),
    cacheOptions: {
      queryKey: ["turso.flashcards.create"],
    },
  },

  update: {
    mutation: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<SelectFlashcard, "id" | "dictionary_entry_id">>;
    }): Promise<SelectFlashcard> =>
      enqueueDbOperation(async () => {
        await ensureDb();
        const drizzleDb = getDrizzleDb();

        const setValues: Partial<InsertFlashcard> = {};

        if ("difficulty" in updates && updates.difficulty !== undefined) {
          setValues.difficulty = updates.difficulty;
        }
        if ("due" in updates && updates.due !== undefined) {
          setValues.due = updates.due;
        }
        if (
          "due_timestamp_ms" in updates &&
          updates.due_timestamp_ms !== undefined
        ) {
          setValues.due_timestamp_ms = updates.due_timestamp_ms;
        }
        if ("elapsed_days" in updates && updates.elapsed_days !== undefined) {
          setValues.elapsed_days = updates.elapsed_days;
        }
        if ("lapses" in updates && updates.lapses !== undefined) {
          setValues.lapses = updates.lapses;
        }
        if (
          "learning_steps" in updates &&
          updates.learning_steps !== undefined
        ) {
          setValues.learning_steps = updates.learning_steps;
        }
        if ("last_review" in updates && updates.last_review !== undefined) {
          setValues.last_review = updates.last_review;
        }
        if (
          "last_review_timestamp_ms" in updates &&
          updates.last_review_timestamp_ms !== undefined
        ) {
          setValues.last_review_timestamp_ms = updates.last_review_timestamp_ms;
        }
        if ("reps" in updates && updates.reps !== undefined) {
          setValues.reps = updates.reps;
        }
        if (
          "scheduled_days" in updates &&
          updates.scheduled_days !== undefined
        ) {
          setValues.scheduled_days = updates.scheduled_days;
        }
        if ("stability" in updates && updates.stability !== undefined) {
          setValues.stability = updates.stability;
        }
        if ("state" in updates && updates.state !== undefined) {
          setValues.state = updates.state;
        }
        if ("is_hidden" in updates && updates.is_hidden !== undefined) {
          setValues.is_hidden = updates.is_hidden;
        }

        if (Object.keys(setValues).length === 0) {
          throw new Error("No fields to update");
        }

        const [res] = await drizzleDb
          .update(flashcards)
          .set(setValues)
          .where(eq(flashcards.id, id))
          .returning();

        if (!res) {
          throw new Error(`Flashcard not found: ${id}`);
        }

        return res;
      }),
    cacheOptions: {
      queryKey: ["turso.flashcards.update"],
    },
  },
  reset: {
    mutation: ({
      dictionary_entry_id,
      direction,
    }: {
      dictionary_entry_id: string;
      direction: SelectFlashcard["direction"];
    }): Promise<SelectFlashcard> =>
      enqueueDbOperation(async () => {
        await ensureDb();
        const drizzleDb = getDrizzleDb();
        const now = new Date();

        const [res] = await drizzleDb
          .update(flashcards)
          .set({
            state: FlashcardState.NEW,
            difficulty: 0,
            stability: 0,
            reps: 0,
            lapses: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            last_review: null,
            last_review_timestamp_ms: null,
            due: now.toISOString(),
            due_timestamp_ms: now.getTime(),
          })
          .where(
            and(
              eq(flashcards.dictionary_entry_id, dictionary_entry_id),
              eq(flashcards.direction, direction)
            )
          )
          .returning();

        if (!res) {
          throw new Error(
            `Flashcard not found for dictionary entry: ${dictionary_entry_id}, direction: ${direction}`
          );
        }

        return res;
      }),
    cacheOptions: {
      queryKey: ["turso.flashcards.reset"],
    },
  },

  findByEntryId: {
    query: async (entryId: string): Promise<SelectFlashcard[]> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      return drizzleDb
        .select()
        .from(flashcards)
        .where(eq(flashcards.dictionary_entry_id, entryId));
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
      direction: SelectFlashcard["direction"];
    }): Promise<{ data: SelectFlashcard | null }> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const [res] = await drizzleDb
        .select()
        .from(flashcards)
        .where(
          and(
            eq(flashcards.dictionary_entry_id, dictionaryEntryId),
            eq(flashcards.direction, direction)
          )
        )
        .limit(1);

      return { data: res ?? null };
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
