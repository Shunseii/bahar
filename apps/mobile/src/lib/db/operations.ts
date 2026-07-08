/**
 * Mobile wiring for the shared @bahar/db-operations factories. All operation
 * logic + tests live in that package; here we just inject mobile's DB
 * singleton via getDb. Same contract as web -- no mobile-specific wrappers.
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
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  type DeckWithCounts,
  FLASHCARD_LIMIT,
  type FlashcardQueue,
  type FlashcardWithDictionaryEntry,
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
