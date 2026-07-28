import {
  makeDecksTable,
  makeDictionaryEntriesTable,
  makeFlashcardsTable,
  makeMigrationTable,
  makeProgressTable,
  makeSettingsTable,
} from "@bahar/db-operations";
import { ensureDb, getDrizzleDb } from ".";

/**
 * Web wiring for the shared @bahar/db-operations factories. Every operation's
 * logic and tests live in that package (verified against a real DB); this file
 * just injects web's DB singleton via `getDb`.
 */
const getDb = async () => {
  await ensureDb();
  return getDrizzleDb();
};

export const decksTable = makeDecksTable({ getDb });
export const settingsTable = makeSettingsTable({ getDb });
export const dictionaryEntriesTable = makeDictionaryEntriesTable({ getDb });
export const progressTable = makeProgressTable({ getDb });
export const migrationTable = makeMigrationTable({ getDb });
export const flashcardsTable = makeFlashcardsTable({ getDb });
