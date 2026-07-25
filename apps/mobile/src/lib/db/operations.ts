/**
 * Mobile wiring for the shared @bahar/db-operations factories. Every
 * operation's logic + tests live in that package; here we inject mobile's DB
 * singleton via getDb. Mirrors web's wiring.
 */

import {
  makeDecksTable,
  makeDictionaryEntriesTable,
  makeFlashcardsTable,
  makeProgressTable,
  makeSettingsTable,
} from "@bahar/db-operations";
import { ensureDb } from ".";
import { getDrizzleDb } from "./adapter";

export {
  clampPostponeWindow,
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  DEFAULT_POSTPONE_WINDOW_DAYS,
  type DeckWithCounts,
  FLASHCARD_LIMIT,
  type FlashcardQueue,
  type FlashcardWithDictionaryEntry,
  keepCurrentCardFirst,
  MAX_POSTPONE_WINDOW_DAYS,
  MIN_POSTPONE_WINDOW_DAYS,
  type PostponeScope,
  postponeCardsPerDay,
} from "@bahar/db-operations";

const getDb = async () => {
  await ensureDb();
  return getDrizzleDb();
};

export const decksTable = makeDecksTable({ getDb });
export const dictionaryEntriesTable = makeDictionaryEntriesTable({ getDb });
export const flashcardsTable = makeFlashcardsTable({ getDb });
export const progressTable = makeProgressTable({ getDb });
export const settingsTable = makeSettingsTable({ getDb });
