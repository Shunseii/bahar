import {
  SelectSetting,
  RawSetting,
  SelectDictionaryEntry,
  RawDictionaryEntry,
  SelectFlashcard,
  RawFlashcard,
  SelectDeck,
  FlashcardState,
  RawDeck,
  InsertDictionaryEntry,
  InsertFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { getDb } from ".";
import { nanoid } from "nanoid";
import {
  buildSelectWithNestedJson,
  convertRawDictionaryEntryToSelectDictionaryEntry,
  DICTIONARY_ENTRY_COLUMNS,
} from "./utils";
import { NullToUndefined } from "../utils";

/**
 * @file Operations to interact with the user database,
 * broken down by table.
 */

/**
 * The threshold after which the UI won't display the
 * exact number of flashcards to review, to not overwhelm
 * the user when they have a lot.
 */
export const FLASHCARD_LIMIT = 100;

type TableOperation = {
  // Note: can't use a generic here to type the output
  // it will still be any when used with satisfies

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: (...args: any[]) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation?: (...args: any[]) => Promise<unknown>;
  /**
   * The cache options for the query in tanstack query.
   */
  cacheOptions: {
    // Prefix with turso to ensure there's no conflict
    // with trpc query keys.
    queryKey: `turso.${string}`[];
    staleTime?: number;
  };
};

export const settingsTable = {
  getSettings: {
    query: async (): Promise<Omit<SelectSetting, "id">> => {
      try {
        const db = getDb();
        const res: RawSetting = await db
          .prepare("SELECT * FROM settings")
          .get();

        return {
          show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
          show_reverse_flashcards: Boolean(res.show_reverse_flashcards),
        };
      } catch (err) {
        console.error("Error in settingsTable.getSettings", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.settings.query"],
    },
  },
  update: {
    mutation: async ({
      updates,
    }: {
      updates: Partial<Omit<SelectSetting, "id">>;
    }): Promise<Omit<SelectSetting, "id">> => {
      try {
        const db = getDb();

        const setClauses: string[] = [];
        const params: unknown[] = [];

        if (
          "show_antonyms_in_flashcard" in updates &&
          updates.show_antonyms_in_flashcard !== undefined
        ) {
          setClauses.push("show_antonyms_in_flashcard = ?");
          params.push(updates.show_antonyms_in_flashcard);
        }
        if (
          "show_reverse_flashcards" in updates &&
          updates.show_reverse_flashcards !== undefined
        ) {
          setClauses.push("show_reverse_flashcards = ?");
          params.push(updates.show_reverse_flashcards ? 1 : 0);
        }

        if (setClauses.length === 0) {
          throw new Error("No fields to update");
        }

        await db
          .prepare(`UPDATE settings SET ${setClauses.join(", ")};`)
          .run(params);

        await db.push();

        const res: RawSetting = await db
          .prepare("SELECT * FROM settings")
          .get();

        return {
          show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
          show_reverse_flashcards: Boolean(res.show_reverse_flashcards),
        };
      } catch (err) {
        console.error("Error in settingsTable.update", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.settings.update"],
    },
  },
} satisfies Record<string, TableOperation>;

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
        const db = getDb();
        const now = Date.now();

        const {
          tags = [],
          types = ["ism", "harf", "fi'l", "expression"],
          state = [
            FlashcardState.NEW,
            FlashcardState.LEARNING,
            FlashcardState.REVIEW,
            FlashcardState.RE_LEARNING,
          ],
        } = filters ?? {};

        const directions = showReverse ? ["forward", "reverse"] : ["forward"];

        const whereConditions: string[] = ["due_timestamp_ms <= ?"];
        const params: unknown[] = [now];

        whereConditions.push(
          `direction IN (${directions.map(() => "?").join(", ")})`,
        );
        params.push(...directions);

        whereConditions.push(`state IN (${state.map(() => "?").join(", ")})`);
        params.push(...state);

        whereConditions.push(`type IN (${types.map(() => "?").join(", ")})`);
        params.push(...types);

        if (tags.length) {
          whereConditions.push(
            `EXISTS (SELECT 1 FROM json_each(tags) WHERE value IN (${tags
              .map(() => "?")
              .join(", ")}))`,
          );
          params.push(...tags);
        }

        whereConditions.push("is_hidden = 0");

        const whereClause = whereConditions.join(" AND ");

        const nestedDictionary = buildSelectWithNestedJson({
          columns: DICTIONARY_ENTRY_COLUMNS,
          jsonObjectAlias: "dictionary_entry",
          tableAlias: "d",
        });

        const sql = `SELECT f.*, ${nestedDictionary}
        FROM flashcards f
        LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id
        WHERE ${whereClause}
        `;

        console.debug("Executing SQL", sql, params);

        const rawResults: (RawFlashcard & {
          dictionary_entry: string;
        })[] = await db.prepare(sql).all(params);

        return rawResults?.map((raw) => {
          const parsedDictionaryEntry =
            convertRawDictionaryEntryToSelectDictionaryEntry(
              JSON.parse(raw.dictionary_entry),
            );

          return {
            ...raw,
            direction: (raw.direction ??
              "forward") as SelectFlashcard["direction"],
            is_hidden: Boolean(raw.is_hidden),
            dictionary_entry: parsedDictionaryEntry,
          };
        });
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
        const db = getDb();
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

        const res: RawFlashcard = await db
          .prepare(`SELECT * FROM flashcards WHERE id = ?;`)
          .get([id]);

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
        const db = getDb();

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

        await db.push();

        const res: RawFlashcard = await db
          .prepare(`SELECT * FROM flashcards WHERE id = ?;`)
          .get([id]);

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
        const db = getDb();
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

        const res: RawFlashcard = await db
          .prepare(
            `SELECT * FROM flashcards WHERE dictionary_entry_id = ? AND direction = ?;`,
          )
          .get([dictionary_entry_id, direction]);

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

export const dictionaryEntriesTable = {
  entry: {
    query: async (id: string): Promise<SelectDictionaryEntry> => {
      try {
        const db = getDb();
        const res: RawDictionaryEntry = await db
          .prepare(`SELECT * FROM dictionary_entries WHERE id = ?`)
          .get([id]);

        return convertRawDictionaryEntryToSelectDictionaryEntry(res);
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
        const db = getDb();

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
        const db = getDb();
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

        await db.push();

        const res: RawDictionaryEntry = await db
          .prepare(`SELECT * FROM dictionary_entries WHERE id = ?;`)
          .get([id]);

        return convertRawDictionaryEntryToSelectDictionaryEntry(res);
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
        const db = getDb();
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

        await db.push();

        const res: RawDictionaryEntry = await db
          .prepare(`SELECT * FROM dictionary_entries WHERE id = ?;`)
          .get([id]);

        return convertRawDictionaryEntryToSelectDictionaryEntry(res);
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
        const db = getDb();

        const res: RawDictionaryEntry = await db
          .prepare("SELECT * FROM dictionary_entries WHERE id = ?;")
          .get([id]);

        await db
          .prepare(`DELETE FROM dictionary_entries WHERE id = ?;`)
          .run([id]);

        await db.push();

        return convertRawDictionaryEntryToSelectDictionaryEntry(res);
      } catch (err) {
        console.error("Error in dictionaryEntriesTable.delete", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.dictionaryEntries.delete"],
    },
  },
} satisfies Record<string, TableOperation>;

export const decksTable = {
  list: {
    query: async ({
      show_reverse,
    }: {
      show_reverse?: boolean;
    }): Promise<(SelectDeck & { to_review: number; total_hits: number })[]> => {
      try {
        const db = getDb();
        const now = Date.now();

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
                types = ["ism", "harf", "fi'l", "expression"],
                state = [0, 1, 2, 3],
              } = deck.filters ?? {};

              const directions = show_reverse
                ? ["forward", "reverse"]
                : ["forward"];

              const whereConditions: string[] = [];
              const toReviewParams: unknown[] = [];
              const totalHitsParams: unknown[] = [];

              whereConditions.push(
                `f.direction IN (${directions.map(() => "?").join(", ")})`,
              );
              toReviewParams.push(...directions);
              totalHitsParams.push(...directions);

              whereConditions.push(
                `f.state IN (${state.map(() => "?").join(", ")})`,
              );
              toReviewParams.push(...state);
              totalHitsParams.push(...state);

              whereConditions.push(
                `d.type IN (${types.map(() => "?").join(", ")})`,
              );
              toReviewParams.push(...types);
              totalHitsParams.push(...types);

              if (tags.length > 0) {
                whereConditions.push(
                  `EXISTS (SELECT 1 FROM json_each(d.tags) WHERE value IN (${tags
                    .map(() => "?")
                    .join(", ")}))`,
                );
                toReviewParams.push(...tags);
                totalHitsParams.push(...tags);
              }

              whereConditions.push("f.is_hidden = 0");

              const whereClause = whereConditions.join(" AND ");

              const toReviewSql = `SELECT COUNT(*) as count FROM flashcards f LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id WHERE f.due_timestamp_ms <= ? AND ${whereClause}`;
              const toReviewAllParams = [now, ...toReviewParams];
              console.debug("Executing toReview query:", {
                sql: toReviewSql,
                params: toReviewAllParams,
                deckId: deck.id,
                deckName: deck.name,
              });

              const toReviewCount: { count: number } = await db
                .prepare(toReviewSql)
                .get(toReviewAllParams);

              console.debug("toReview result:", toReviewCount);

              const totalHitsSql = `SELECT COUNT(*) as count FROM flashcards f LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id WHERE ${whereClause}`;

              console.debug("Executing totalHits query:", {
                sql: totalHitsSql,
                params: totalHitsParams,
                deckId: deck.id,
                deckName: deck.name,
              });

              const totalHitsCount: { count: number } = await db
                .prepare(totalHitsSql)
                .get([...totalHitsParams]);

              console.debug("totalHits result:", totalHitsCount);

              return {
                ...deck,
                to_review: toReviewCount?.count ?? 0,
                total_hits: totalHitsCount?.count ?? 0,
              };
            } catch (err) {
              console.error("Error processing deck", err);
              throw err;
            }
          }),
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
        const db = getDb();
        const id = nanoid();

        await db
          .prepare(`INSERT INTO decks (id, name, filters) VALUES (?, ?, ?);`)
          .run([
            id,
            deck.name,
            deck.filters ? JSON.stringify(deck.filters) : null,
          ]);

        await db.push();

        const res: RawDeck = await db
          .prepare(`SELECT * FROM decks WHERE id = ?;`)
          .get([id]);

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
        const db = getDb();

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

        await db.push();

        const res: RawDeck = await db
          .prepare(`SELECT * FROM decks WHERE id = ?;`)
          .get([id]);

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
        const db = getDb();

        await db.prepare(`DELETE FROM decks WHERE id = ?;`).run([id]);

        await db.push();

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
