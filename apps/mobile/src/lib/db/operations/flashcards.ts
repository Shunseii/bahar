/**
 * Flashcard operations for mobile — thin wiring over the shared
 * @bahar/db-operations factory. Preserves mobile's existing contract:
 * findByEntryId takes `{ entryId }` (the shared factory takes a bare string),
 * and createForEntry (create the forward+reverse pair for a new entry) is
 * mobile-only, so both are adapted/added here.
 */

import { makeFlashcardsTable } from "@bahar/db-operations";
import {
  FlashcardState,
  type SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { getDb } from "./get-db";

export type {
  FlashcardQueue,
  FlashcardWithDictionaryEntry,
} from "@bahar/db-operations";
export {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  FLASHCARD_LIMIT,
} from "@bahar/db-operations";

const base = makeFlashcardsTable({ getDb });

export const flashcardsTable = {
  ...base,
  findByEntryId: {
    query: ({ entryId }: { entryId: string }): Promise<SelectFlashcard[]> =>
      base.findByEntryId.query(entryId),
    cacheOptions: base.findByEntryId.cacheOptions,
  },
  createForEntry: {
    mutation: async ({
      dictionary_entry_id,
    }: {
      dictionary_entry_id: string;
    }): Promise<{ forward: SelectFlashcard; reverse: SelectFlashcard }> => {
      const due = new Date().toISOString();

      const create = (direction: "forward" | "reverse") =>
        base.create.mutation({
          flashcard: {
            dictionary_entry_id,
            difficulty: 0,
            due,
            elapsed_days: 0,
            lapses: 0,
            last_review: null,
            reps: 0,
            scheduled_days: 0,
            stability: 0,
            state: FlashcardState.NEW,
            direction,
          },
        });

      const [forward, reverse] = await Promise.all([
        create("forward"),
        create("reverse"),
      ]);

      return { forward, reverse };
    },
    cacheOptions: {
      queryKey: ["turso.flashcards.createForEntry"] as const,
    },
  },
};
