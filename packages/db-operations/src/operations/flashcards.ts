import {
  dictionaryEntries,
  FlashcardState,
  flashcards,
  type InsertFlashcard,
  type SelectDeck,
  type SelectDictionaryEntry,
  type SelectFlashcard,
  settings,
  WORD_TYPES,
} from "@bahar/drizzle-user-db-schemas";
import {
  createNewFlashcard,
  createScheduler,
  forgetFlashcard,
} from "@bahar/fsrs";
import { addDays, startOfDay } from "date-fns";
import { and, countDistinct, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid/non-secure";
import type { ReviewLog } from "ts-fsrs";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  DEFAULT_POSTPONE_WINDOW_DAYS,
  MAX_POSTPONE_WINDOW_DAYS,
  MIN_POSTPONE_WINDOW_DAYS,
} from "../constants";
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
 * Merges a refetched review queue into the one already on screen without moving
 * the card being reviewed.
 *
 * `today` is refetched mid-session (app foreground, window focus, invalidation),
 * and each run re-evaluates "is due" against a fresh now, so cards can join the
 * queue while the user is part-way through a card. Replacing the queue outright
 * let a joining card take index 0 and yank the current card away mid-answer.
 *
 * Deliberately independent of how the query sorts: the card being reviewed is
 * pinned wherever the refetch placed it, so `today`'s ORDER BY can change without
 * reopening this bug. The refetched set stays authoritative about which cards are
 * in the queue -- cards no longer due are dropped -- only the position of the
 * current card is preserved.
 */
export const keepCurrentCardFirst = ({
  prev,
  next,
}: {
  prev: FlashcardWithDictionaryEntry[];
  next: FlashcardWithDictionaryEntry[];
}): FlashcardWithDictionaryEntry[] => {
  const currentId = prev[0]?.id;
  if (!currentId) return next;

  const current = next.find((card) => card.id === currentId);
  if (!current) return next;

  return [current, ...next.filter((card) => card.id !== currentId)];
};

/**
 * Which overdue cards a postpone run moves.
 *
 * Deliberately not `FlashcardQueue` -- that type's "regular" member would mean
 * "postpone only the cards overdue by less than the backlog threshold", which
 * isn't a thing anyone wants.
 */
export type PostponeScope = "all" | "backlog";

/**
 * Bounds a user-entered postpone window to something that actually does
 * something.
 *
 * The upper bound is the card count, not just MAX_POSTPONE_WINDOW_DAYS:
 * spreading 5 cards over 20 days leaves 15 days empty, so any window past the
 * pile size is a bigger number with no effect. Purely a UI concern --
 * `assignPostponedDueDates` handles an oversized window fine, it just doesn't
 * use the extra days.
 *
 * `cardCount` of 0 has no meaningful window; callers are expected to disable
 * the action entirely rather than rely on the floor returned here.
 */
export const clampPostponeWindow = ({
  windowDays,
  cardCount,
}: {
  windowDays: number;
  cardCount: number;
}): number => {
  if (!Number.isFinite(windowDays)) {
    return MIN_POSTPONE_WINDOW_DAYS;
  }

  const max = Math.min(cardCount, MAX_POSTPONE_WINDOW_DAYS);
  if (max < MIN_POSTPONE_WINDOW_DAYS) {
    return MIN_POSTPONE_WINDOW_DAYS;
  }

  return Math.min(
    Math.max(Math.floor(windowDays), MIN_POSTPONE_WINDOW_DAYS),
    max
  );
};

/**
 * Cards per day a given window works out to, for the UI to show alongside the
 * window input -- "14 days" means nothing to a user deciding, "53 cards a day"
 * does.
 *
 * Rounds up because that's what the round-robin deal produces: the first
 * `cardCount % windowDays` days get the extra card.
 */
export const postponeCardsPerDay = ({
  cardCount,
  windowDays,
}: {
  cardCount: number;
  windowDays: number;
}): number => {
  const days = Math.max(MIN_POSTPONE_WINDOW_DAYS, Math.floor(windowDays));

  return Math.ceil(cardCount / days);
};

/**
 * Cards within a single day are spaced by a second so `today`'s
 * `ORDER BY due_timestamp_ms` returns a stable order. Sharing one timestamp
 * across a day's cards would leave their relative order up to SQLite.
 */
const WITHIN_DAY_STAGGER_MS = 1000;

/**
 * Spreads overdue cards evenly across a window of days starting today,
 * returning only the new due fields per card.
 *
 * Cards are dealt round-robin over the input order (`index % windowDays`)
 * rather than sorted by difficulty. Dealing easiest-first would make day 0 feel
 * winnable, but it also makes every day harder than the last: a user who lapses
 * again partway through is left holding nothing but the cards they're least
 * likely to remember. Round-robin keeps each day a representative slice of the
 * pile, so stopping midway leaves a remainder that looks like what was already
 * done. Callers pass cards in due order, so each day gets an even mix of
 * mildly- and severely-overdue cards.
 *
 * Day 0 is today, not tomorrow, so the user still has cards to review right
 * after running this.
 */
export const assignPostponedDueDates = ({
  cards,
  now,
  windowDays,
}: {
  cards: { id: string }[];
  now: Date;
  windowDays: number;
}): Pick<SelectFlashcard, "id" | "due" | "due_timestamp_ms">[] => {
  const days = Math.max(1, Math.floor(windowDays));
  const nowMs = now.getTime();

  // startOfDay(addDays(...)) rather than adding 24h per day: across a DST
  // boundary a fixed 24h offset lands an hour off the intended midnight.
  const dayStarts = Array.from({ length: days }, (_, day) =>
    startOfDay(addDays(now, day)).getTime()
  );

  return cards.map((card, index) => {
    const day = index % days;
    const positionInDay = Math.floor(index / days);
    const staggered = dayStarts[day] + positionInDay * WITHIN_DAY_STAGGER_MS;

    // Day 0 starts at midnight and staggers forward, which can overshoot `now`
    // when postponing shortly after midnight or with a very large pile. A due
    // date in the future would drop the card out of the due query, so today's
    // cards are clamped to now -- they must stay reviewable today.
    const dueTimestampMs = day === 0 ? Math.min(staggered, nowMs) : staggered;

    return {
      id: card.id,
      due: new Date(dueTimestampMs).toISOString(),
      due_timestamp_ms: dueTimestampMs,
    };
  });
};

/**
 * Builds the shared filter conditions used by both today and counts: FSRS
 * state, dictionary-entry type, not-hidden, and an optional tag membership
 * check via json_each. Defaults mirror the UI's "everything" selection when a
 * filter is unset.
 *
 * Reverse cards are no longer gated by a global setting -- a reverse card is
 * simply whatever `direction = 'reverse'` rows exist (per-word row presence),
 * so both directions are always included and there is no direction condition.
 */
const buildFilterConditions = ({
  filters,
}: {
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

  return [
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

export const makeFlashcardsTable = ({ getDb }: OperationDeps) =>
  ({
    today: {
      query: async ({
        filters,
        queue = "all",
        backlogThresholdDays = DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }: {
        filters?: SelectDeck["filters"];
        queue?: FlashcardQueue;
        backlogThresholdDays?: number;
      } = {}): Promise<FlashcardWithDictionaryEntry[]> => {
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
          ...buildFilterConditions({ filters }),
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
          .where(and(...conditions))
          .orderBy(flashcards.due_timestamp_ms);
      },
      cacheOptions: {
        queryKey: ["turso.flashcards.today.query"],
      },
    },
    counts: {
      query: async ({
        filters,
        backlogThresholdDays = DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }: {
        filters?: SelectDeck["filters"];
        backlogThresholdDays?: number;
      } = {}): Promise<{ regular: number; backlog: number; total: number }> => {
        const drizzleDb = await getDb();
        const now = Date.now();
        const backlogThresholdMs = now - daysToMs(backlogThresholdDays);

        const baseConditions = buildFilterConditions({ filters });

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
    upcomingDue: {
      /**
       * Future due timestamps (unix ms) for non-hidden cards, within an optional
       * horizon, sorted ascending -- one entry per card. Unlike `today`/`counts`
       * (which hard-filter to `due <= now`), this reads the *upcoming* schedule.
       * Used by mobile review-reminder notifications to know when cards next
       * become due; callers bucket/aggregate the timestamps.
       */
      query: async ({
        filters,
        horizonMs,
      }: {
        filters?: SelectDeck["filters"];
        horizonMs?: number;
      } = {}): Promise<number[]> => {
        const drizzleDb = await getDb();
        const now = Date.now();

        const conditions = [
          gt(flashcards.due_timestamp_ms, now),
          ...(horizonMs != null
            ? [lte(flashcards.due_timestamp_ms, now + horizonMs)]
            : []),
          ...buildFilterConditions({ filters }),
        ];

        const rows = await drizzleDb
          .select({ due_timestamp_ms: flashcards.due_timestamp_ms })
          .from(flashcards)
          .innerJoin(
            dictionaryEntries,
            eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
          )
          .where(and(...conditions))
          .orderBy(flashcards.due_timestamp_ms);

        return rows.map((row) => row.due_timestamp_ms);
      },
      cacheOptions: {
        queryKey: ["turso.flashcards.upcomingDue"],
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
      }): Promise<{ flashcard: SelectFlashcard; log: ReviewLog }> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();
          const now = new Date();

          const [current] = await drizzleDb
            .select()
            .from(flashcards)
            .where(
              and(
                eq(flashcards.dictionary_entry_id, dictionary_entry_id),
                eq(flashcards.direction, direction)
              )
            );

          if (!current) {
            throw new Error(
              `Flashcard not found for dictionary entry: ${dictionary_entry_id}, direction: ${direction}`
            );
          }

          const scheduler = createScheduler();
          const { card, log } = forgetFlashcard(scheduler, current, now);

          const [res] = await drizzleDb
            .update(flashcards)
            .set(card)
            .where(eq(flashcards.id, current.id))
            .returning();

          if (!res) {
            throw new Error(`Flashcard not found: ${current.id}`);
          }

          return { flashcard: res, log };
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
     * Creates the flashcards a new dictionary entry starts with. Forward is
     * always created; reverse is created only when the `create_reverse_by_default`
     * setting is on -- reverse existence is per-word row presence, so a new word
     * gets a reverse card only if the create-time default says so (toggle it
     * later per word via `setReverse`). Both start as fresh FSRS cards
     * (createNewFlashcard = the canonical empty card, due now).
     */
    createFlashcardPair: {
      mutation: ({
        dictionary_entry_id,
        createReverse,
      }: {
        dictionary_entry_id: string;
        /**
         * Per-word override for whether to create a reverse card. When omitted,
         * falls back to the `create_reverse_by_default` setting. The add-word
         * form passes this so a word can opt in/out at creation regardless of
         * the default.
         */
        createReverse?: boolean;
      }): Promise<{
        forward: SelectFlashcard;
        reverse: SelectFlashcard | null;
      }> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();

          let shouldCreateReverse = createReverse;
          if (shouldCreateReverse === undefined) {
            const [settingsRow] = await drizzleDb
              .select({ createReverse: settings.create_reverse_by_default })
              .from(settings)
              .limit(1);
            shouldCreateReverse = settingsRow?.createReverse ?? false;
          }

          const directions: SelectFlashcard["direction"][] = shouldCreateReverse
            ? ["forward", "reverse"]
            : ["forward"];

          const values = directions.map((direction) => ({
            id: nanoid(),
            is_hidden: false,
            ...createNewFlashcard(dictionary_entry_id, direction),
          }));

          const rows = await drizzleDb
            .insert(flashcards)
            .values(values)
            .returning();

          const forward = rows.find((r) => r.direction === "forward");
          const reverse = rows.find((r) => r.direction === "reverse") ?? null;

          if (!forward) {
            throw new Error(
              `Failed to create forward flashcard for entry: ${dictionary_entry_id}`
            );
          }

          return { forward, reverse };
        }),
      cacheOptions: {
        queryKey: ["turso.flashcards.createFlashcardPair"],
      },
    },
    /**
     * Per-word reverse toggle. Reverse existence = row presence, so enabling
     * creates a fresh reverse card (born due now -- state NEW, "due today",
     * never old-due, so it can't surface as backlog) and disabling deletes the
     * row. Enable is idempotent (returns the existing card if already present);
     * disabling drops FSRS progress, which the caller should confirm.
     */
    setReverse: {
      mutation: ({
        dictionary_entry_id,
        enabled,
      }: {
        dictionary_entry_id: string;
        enabled: boolean;
      }): Promise<{ reverse: SelectFlashcard | null }> =>
        enqueueDbOperation(async () => {
          const drizzleDb = await getDb();

          const [existing] = await drizzleDb
            .select()
            .from(flashcards)
            .where(
              and(
                eq(flashcards.dictionary_entry_id, dictionary_entry_id),
                eq(flashcards.direction, "reverse")
              )
            )
            .limit(1);

          if (enabled) {
            if (existing) {
              return { reverse: existing };
            }

            const [row] = await drizzleDb
              .insert(flashcards)
              .values({
                id: nanoid(),
                is_hidden: false,
                ...createNewFlashcard(dictionary_entry_id, "reverse"),
              })
              .returning();

            if (!row) {
              throw new Error(
                `Failed to create reverse flashcard for entry: ${dictionary_entry_id}`
              );
            }

            return { reverse: row };
          }

          if (existing) {
            await drizzleDb
              .delete(flashcards)
              .where(eq(flashcards.id, existing.id));
          }

          return { reverse: null };
        }),
      cacheOptions: {
        queryKey: ["turso.flashcards.setReverse"],
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
     * Postpones an overdue pile by spreading it across a short window of days
     * starting today, in a single transaction, yielding progress as it goes.
     *
     * Only `due` (and its `due_timestamp_ms` twin) is rewritten. `due` is a
     * scheduler OUTPUT, not an input to FSRS's memory model, so moving it is
     * safe -- `stability`, `difficulty`, `last_review`, `state` and the counters
     * are deliberately absent from the SET clause below. This is why postpone
     * exists instead of bulk-grading the pile: a synthetic grade would inject
     * reviews that never happened and corrupt the model's estimate of what the
     * user actually knows.
     *
     * ts-fsrs has no postpone primitive. Its `reschedule()` is a
     * history-replay / parameter-migration tool and would recompute memory
     * state, which is the opposite of what's wanted here.
     *
     * CALLER CONTRACT: the transaction stays open across every `yield`, and
     * progress is yielded before COMMIT. Consumers must therefore drain the
     * whole generator inside `enqueueDbOperation` so nothing else touches the
     * connection mid-transaction -- the periodic sync's pull/push runs on that
     * same single-slot queue, and firing it between two chunks would hit a
     * connection with an open transaction.
     */
    postpone: {
      async *generator({
        filters,
        scope = "all",
        backlogThresholdDays = DEFAULT_BACKLOG_THRESHOLD_DAYS,
        windowDays = DEFAULT_POSTPONE_WINDOW_DAYS,
      }: {
        filters?: SelectDeck["filters"];
        scope?: PostponeScope;
        backlogThresholdDays?: number;
        windowDays?: number;
      } = {}): AsyncGenerator<{ postponed: number; total: number }> {
        const drizzleDb = await getDb();
        const now = new Date();
        const nowMs = now.getTime();

        // "all" takes everything currently due; "backlog" only what's overdue
        // past the backlog threshold, leaving mildly-overdue cards due today.
        const cutoffMs =
          scope === "backlog" ? nowMs - daysToMs(backlogThresholdDays) : nowMs;

        const conditions = [
          lte(flashcards.due_timestamp_ms, cutoffMs),
          ...buildFilterConditions({ filters }),
        ];

        // Ordered by due so the round-robin deal in assignPostponedDueDates
        // hands each day an even mix of mildly- and severely-overdue cards.
        // Also makes the assignment deterministic rather than dependent on
        // whatever row order SQLite happens to return.
        const overdueCards = await drizzleDb
          .selectDistinct({ id: flashcards.id })
          .from(flashcards)
          .leftJoin(
            dictionaryEntries,
            eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
          )
          .where(and(...conditions))
          .orderBy(flashcards.due_timestamp_ms);

        const total = overdueCards.length;

        if (total === 0) {
          return;
        }

        const assignments = assignPostponedDueDates({
          cards: overdueCards,
          now,
          windowDays,
        });

        // Reschedule in chunks: one `UPDATE ... FROM (VALUES ...)` per chunk
        // instead of one UPDATE per card, collapsing thousands of round-trips
        // into a handful. Progress is yielded per chunk, so the UI bar advances
        // in steps of up to CHUNK_SIZE.
        const CHUNK_SIZE = 100;

        let committed = false;
        await drizzleDb.run(sql`BEGIN TRANSACTION`);
        try {
          for (let start = 0; start < assignments.length; start += CHUNK_SIZE) {
            const chunk = assignments.slice(start, start + CHUNK_SIZE);

            // SQLite names VALUES columns column1..columnN (no aliased column
            // list), so the SET clause below references them positionally.
            // Order must match: id, due, due_timestamp_ms.
            const rows = chunk.map(
              ({ id, due, due_timestamp_ms }) =>
                sql`(${id}, ${due}, ${due_timestamp_ms})`
            );

            await drizzleDb.run(sql`
              UPDATE flashcards
              SET
                due = v.column2,
                due_timestamp_ms = v.column3
              FROM (VALUES ${sql.join(rows, sql`, `)}) AS v
              WHERE flashcards.id = v.column1
            `);

            yield { postponed: Math.min(start + CHUNK_SIZE, total), total };
          }
          await drizzleDb.run(sql`COMMIT`);
          committed = true;
        } finally {
          if (!committed) {
            await drizzleDb.run(sql`ROLLBACK`);
          }
        }
      },
      cacheOptions: {
        queryKey: ["turso.flashcards.postpone"],
      },
    },
  }) satisfies Record<string, TableOperation>;
