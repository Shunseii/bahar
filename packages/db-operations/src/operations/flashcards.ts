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
import { createNewFlashcard, createScheduler } from "@bahar/fsrs";
import { and, countDistinct, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid/non-secure";
import { type Card, Rating, type ReviewLog } from "ts-fsrs";
import { DEFAULT_BACKLOG_THRESHOLD_DAYS } from "../constants";
import { enqueueDbOperation } from "../queue";
import type { TableOperation } from "../types";
import type { OperationDeps } from "./deps";

/**
 * Converts days to milliseconds.
 */
const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

export type FlashcardWithDictionaryEntry = SelectFlashcard & {
  dictionary_entry: SelectDictionaryEntry;
};

export type FlashcardQueue = "regular" | "backlog" | "all";

/**
 * A review-log entry produced by clearBacklog for each rescheduled card,
 * shaped for the server's revlog batch endpoint. Handed to the injected
 * `postRevlogBatch` callback -- this package never talks to the API or Sentry
 * itself, so the host app owns sending these and reporting any failure.
 */
export type ClearBacklogRevlogEntry = Omit<
  ReviewLog,
  "due" | "review" | "rating"
> & {
  due: string;
  review: string;
  rating: "hard";
  direction: SelectFlashcard["direction"];
  dictionary_entry_id: string;
  source: "clear_backlog";
};

/**
 * Builds the shared filter conditions used by both today and counts:
 * direction, FSRS state, dictionary-entry type, not-hidden, and an optional
 * tag membership check via json_each. Defaults mirror the UI's "everything"
 * selection when a filter is unset.
 */
const buildFilterConditions = ({
  showReverse,
  filters,
}: {
  showReverse?: boolean;
  filters?: SelectDeck["filters"];
}) => {
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

  return [
    inArray(flashcards.direction, directions),
    inArray(flashcards.state, state),
    inArray(dictionaryEntries.type, types),
    eq(flashcards.is_hidden, false),
    ...(tags.length > 0
      ? [
          // Non-correlated subquery, not `EXISTS (json_each(...))`. The
          // correlated form re-runs json_each per candidate row, which the WASM
          // SQLite build evaluates pathologically slowly for filters matching
          // many rows (effectively hangs, wedging the single connection).
          // Materializing the matching entry ids once keeps it in the tens of ms.
          sql`${dictionaryEntries.id} IN (SELECT de_t.id FROM dictionary_entries de_t, json_each(de_t.tags) jt WHERE jt.value IN (${sql.join(
            tags.map((t) => sql`${t}`),
            sql`, `
          )}))`,
        ]
      : []),
  ];
};

export const makeFlashcardsTable = (
  { getDb }: OperationDeps,
  {
    postRevlogBatch,
  }: {
    /**
     * Called once (fire-and-forget) after clearBacklog commits, with the
     * review-log entries for the rescheduled cards. The host app wires it to
     * send them to the server and report failures -- this package owns neither
     * the API client nor error reporting. Flashcards-specific, so it's a
     * separate argument rather than part of the shared OperationDeps.
     */
    postRevlogBatch?: (entries: ClearBacklogRevlogEntry[]) => void;
  } = {}
) =>
  ({
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
        const drizzleDb = await getDb();
        const now = Date.now();
        const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

        const conditions = [
          lte(flashcards.due_timestamp_ms, now),
          ...(queue === "regular"
            ? [gt(flashcards.due_timestamp_ms, backlogThresholdMs)]
            : []),
          ...(queue === "backlog"
            ? [lte(flashcards.due_timestamp_ms, backlogThresholdMs)]
            : []),
          ...buildFilterConditions({ showReverse, filters }),
        ];

        return drizzleDb
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
            dictionary_entry: {
              // Explicitly aliased: dictionaryEntries.id would otherwise
              // compile to a bare, unaliased "id" column in the SQL, which is
              // literally the same raw name as flashcards.id above. drizzle
              // doesn't disambiguate that on its own -- see buildDrizzleDb in
              // the test harness for the full explanation. Must be unique
              // against every other selected name in this query, not just the
              // field it's disambiguating from -- "dictionary_entry_id" looked
              // safe but collides with the flat field above.
              id: sql<string>`${dictionaryEntries.id}`.as(
                "joined_dictionary_entry_id"
              ),
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
              created_at_timestamp_ms:
                dictionaryEntries.created_at_timestamp_ms,
              updated_at: dictionaryEntries.updated_at,
              updated_at_timestamp_ms:
                dictionaryEntries.updated_at_timestamp_ms,
            },
          })
          .from(flashcards)
          .innerJoin(
            dictionaryEntries,
            eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
          )
          .where(and(...conditions));
      },
      cacheOptions: {
        queryKey: ["turso.flashcards.today.query"],
      },
    },
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
        const drizzleDb = await getDb();
        const now = Date.now();
        const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

        const baseConditions = buildFilterConditions({ showReverse, filters });

        const [regularResult] = await drizzleDb
          .select({ count: countDistinct(flashcards.id) })
          .from(flashcards)
          .leftJoin(
            dictionaryEntries,
            eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
          )
          .where(
            and(
              lte(flashcards.due_timestamp_ms, now),
              gt(flashcards.due_timestamp_ms, backlogThresholdMs),
              ...baseConditions
            )
          );

        const [backlogResult] = await drizzleDb
          .select({ count: countDistinct(flashcards.id) })
          .from(flashcards)
          .leftJoin(
            dictionaryEntries,
            eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
          )
          .where(
            and(
              lte(flashcards.due_timestamp_ms, backlogThresholdMs),
              ...baseConditions
            )
          );

        const regular = regularResult?.count ?? 0;
        const backlog = backlogResult?.count ?? 0;

        return { regular, backlog, total: regular + backlog };
      },
      cacheOptions: {
        queryKey: ["turso.flashcards.counts"],
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
          const drizzleDb = await getDb();

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
          const drizzleDb = await getDb();

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
            setValues.last_review_timestamp_ms =
              updates.last_review_timestamp_ms;
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
          const drizzleDb = await getDb();
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
        const drizzleDb = await getDb();

        return drizzleDb
          .select()
          .from(flashcards)
          .where(eq(flashcards.dictionary_entry_id, entryId));
      },
      cacheOptions: {
        queryKey: ["turso.flashcards.findByEntryId"],
      },
    },
    /**
     * Creates the forward + reverse flashcard pair for a dictionary entry --
     * the two review cards every new entry gets. Both start as fresh FSRS
     * cards (createNewFlashcard = the canonical empty card, due now).
     */
    createFlashcardPair: {
      mutation: ({
        dictionary_entry_id,
      }: {
        dictionary_entry_id: string;
      }): Promise<{ forward: SelectFlashcard; reverse: SelectFlashcard }> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();

          const values = (["forward", "reverse"] as const).map((direction) => ({
            id: nanoid(),
            is_hidden: false,
            ...createNewFlashcard(dictionary_entry_id, direction),
          }));

          const rows = await drizzleDb
            .insert(flashcards)
            .values(values)
            .returning();

          const forward = rows.find((r) => r.direction === "forward");
          const reverse = rows.find((r) => r.direction === "reverse");

          if (!(forward && reverse)) {
            throw new Error(
              `Failed to create flashcard pair for entry: ${dictionary_entry_id}`
            );
          }

          return { forward, reverse };
        }),
      cacheOptions: {
        queryKey: ["turso.flashcards.createFlashcardPair"],
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
        const drizzleDb = await getDb();

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
        queryKey: ["turso.flashcards.findByEntryAndDirection"],
      },
    },
    /**
     * Clear backlog by grading all backlog cards as "Hard". This reschedules
     * them without fully resetting progress, in a single transaction, yielding
     * progress as it goes.
     *
     * `postRevlogBatch` (optional, fire-and-forget) is called once after the
     * transaction commits with the review-log entries for the rescheduled
     * cards. The host app wires it to send the entries to the server and report
     * any failure -- this package deliberately owns neither the API client nor
     * error reporting.
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
        const drizzleDb = await getDb();
        const now = Date.now();
        const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

        const conditions = [
          lte(flashcards.due_timestamp_ms, backlogThresholdMs),
          ...buildFilterConditions({ showReverse, filters }),
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
                last_review_timestamp_ms:
                  newCard.last_review?.getTime() ?? null,
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
          postRevlogBatch?.(
            revlogEntries.map(({ log, direction, dictionary_entry_id }) => ({
              ...log,
              due: log.due.toISOString(),
              review: log.review.toISOString(),
              rating: "hard",
              direction,
              dictionary_entry_id,
              source: "clear_backlog",
            }))
          );
        }
      },
      cacheOptions: {
        queryKey: ["turso.flashcards.clearBacklog"],
      },
    },
  }) satisfies Record<string, TableOperation>;
