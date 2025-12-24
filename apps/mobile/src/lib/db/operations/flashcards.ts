/**
 * Flashcard database operations for mobile app.
 */

export const FLASHCARD_LIMIT = 100;

import {
  SelectFlashcard,
  RawFlashcard,
  SelectDeck,
  FlashcardState,
  InsertFlashcard,
  WORD_TYPES,
  SelectDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import {
  buildSelectWithNestedJson,
  convertRawDictionaryEntryToSelect,
  DICTIONARY_ENTRY_COLUMNS,
  generateId,
  type TableOperation,
} from "@bahar/db-operations";
import { ensureDb } from "..";

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
      WHERE ${whereClause}${tagCondition}`;

      const rawResults = await db
        .prepare<RawFlashcard & { dictionary_entry: string }>(sql)
        .all([...params, ...tagParams]);

      console.log(`[flashcards] Found ${rawResults.length} due flashcards`);

      return rawResults
        .map((raw) => {
          const result = convertRawDictionaryEntryToSelect(
            JSON.parse(raw.dictionary_entry),
          );

          if (!result.ok) {
            console.warn(
              `Flashcard query: failed to parse dictionary entry for flashcard ${raw.id}`,
              result.error,
            );
            return null;
          }

          return {
            ...raw,
            direction: (raw.direction ?? "forward") as SelectFlashcard["direction"],
            is_hidden: Boolean(raw.is_hidden),
            dictionary_entry: result.value,
          };
        })
        .filter((entry): entry is FlashcardWithDictionaryEntry => entry !== null);
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.today.query"] as const,
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
      const db = await ensureDb();
      const id = generateId();
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

      const res = await db
        .prepare<RawFlashcard>(`SELECT * FROM flashcards WHERE id = ?;`)
        .get([id]);

      if (!res) {
        throw new Error(`Failed to retrieve newly created flashcard: ${id}`);
      }

      return {
        ...res,
        direction: (res.direction ?? "forward") as SelectFlashcard["direction"],
        is_hidden: Boolean(res.is_hidden),
      };
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.create"] as const,
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
      const db = await ensureDb();

      const setClauses: string[] = [];
      const params: unknown[] = [];

      const fields = [
        "difficulty",
        "due",
        "due_timestamp_ms",
        "elapsed_days",
        "lapses",
        "last_review",
        "last_review_timestamp_ms",
        "reps",
        "scheduled_days",
        "stability",
        "state",
        "is_hidden",
      ] as const;

      for (const field of fields) {
        if (field in updates && updates[field] !== undefined) {
          setClauses.push(`${field} = ?`);
          params.push(updates[field]);
        }
      }

      if (setClauses.length === 0) {
        throw new Error("No fields to update");
      }

      params.push(id);

      await db
        .prepare(`UPDATE flashcards SET ${setClauses.join(", ")} WHERE id = ?;`)
        .run(params);

      const res = await db
        .prepare<RawFlashcard>(`SELECT * FROM flashcards WHERE id = ?;`)
        .get([id]);

      if (!res) {
        throw new Error(`Flashcard not found: ${id}`);
      }

      return {
        ...res,
        direction: (res.direction ?? "forward") as SelectFlashcard["direction"],
        is_hidden: Boolean(res.is_hidden),
      };
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.update"] as const,
    },
  },

  createForEntry: {
    mutation: async ({
      dictionary_entry_id,
    }: {
      dictionary_entry_id: string;
    }): Promise<{ forward: SelectFlashcard; reverse: SelectFlashcard }> => {
      const db = await ensureDb();
      const now = new Date();
      const dueDate = now.toISOString();
      const dueDateMs = now.getTime();

      const createFlashcard = async (direction: "forward" | "reverse") => {
        const id = generateId();

        await db
          .prepare(
            `INSERT INTO flashcards (
          id, dictionary_entry_id, difficulty, due, due_timestamp_ms, elapsed_days,
          lapses, last_review, last_review_timestamp_ms, reps, scheduled_days, stability, state, direction, is_hidden
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run([
            id,
            dictionary_entry_id,
            0, // difficulty
            dueDate,
            dueDateMs,
            0, // elapsed_days
            0, // lapses
            null, // last_review
            null, // last_review_timestamp_ms
            0, // reps
            0, // scheduled_days
            0, // stability
            FlashcardState.NEW,
            direction,
            0, // is_hidden
          ]);

        const res = await db
          .prepare<RawFlashcard>(`SELECT * FROM flashcards WHERE id = ?;`)
          .get([id]);

        if (!res) {
          throw new Error(`Failed to retrieve newly created flashcard: ${id}`);
        }

        return {
          ...res,
          direction: (res.direction ?? "forward") as SelectFlashcard["direction"],
          is_hidden: Boolean(res.is_hidden),
        };
      };

      const [forward, reverse] = await Promise.all([
        createFlashcard("forward"),
        createFlashcard("reverse"),
      ]);

      return { forward, reverse };
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.createForEntry"] as const,
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

      const res = await db
        .prepare<RawFlashcard>(
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
        direction: (res.direction ?? "forward") as SelectFlashcard["direction"],
        is_hidden: Boolean(res.is_hidden),
      };
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.reset"] as const,
    },
  },
} as const satisfies Record<string, TableOperation>;
