import {
  type ClearBacklogRevlogEntry,
  makeDecksTable,
  makeDictionaryEntriesTable,
  makeFlashcardsTable,
  makeMigrationTable,
  makeProgressTable,
  makeSettingsTable,
} from "@bahar/db-operations";
import * as Sentry from "@sentry/react";
import { api } from "../api";
import { ensureDb, getDrizzleDb } from ".";

/**
 * Web wiring for the shared @bahar/db-operations factories. Every operation's
 * logic and tests live in that package (verified against a real DB); this file
 * just injects web's DB singleton via `getDb`, plus -- for clearBacklog -- the
 * revlog batch post, which is web-specific (Eden API client + Sentry).
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

/**
 * Sends the clearBacklog review logs to the server, reporting failures to
 * Sentry. Fire-and-forget -- clearBacklog doesn't await this.
 */
const postClearBacklogRevlogs = (entries: ClearBacklogRevlogEntry[]) => {
  api.stats.revlogs.batch
    .post({ entries })
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
};

export const flashcardsTable = makeFlashcardsTable(
  { getDb },
  { postRevlogBatch: postClearBacklogRevlogs }
);
