/**
 * Mobile wiring for the shared @bahar/db-operations factories. Every
 * operation's logic + tests live in that package; here we inject mobile's DB
 * singleton via getDb, plus -- for clearBacklog -- the revlog batch post, which
 * is mobile-specific (Eden API client). Mirrors web's wiring.
 */

import {
  type ClearBacklogRevlogEntry,
  makeDecksTable,
  makeDictionaryEntriesTable,
  makeFlashcardsTable,
  makeProgressTable,
  makeSettingsTable,
} from "@bahar/db-operations";
import * as Sentry from "@sentry/react-native";
import { api } from "../../utils/api";
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

/**
 * Sends the clearBacklog review logs to the server. Fire-and-forget --
 * clearBacklog doesn't await this. Failures are captured to Sentry, matching
 * web's clearBacklog.revlogs tag.
 */
const postClearBacklogRevlogs = (entries: ClearBacklogRevlogEntry[]) => {
  api.stats.revlogs.batch.post({ entries }).catch((err) => {
    Sentry.captureException(err, {
      tags: { operation: "clearBacklog.revlogs" },
    });
  });
};

export const decksTable = makeDecksTable({ getDb });
export const dictionaryEntriesTable = makeDictionaryEntriesTable({ getDb });
export const flashcardsTable = makeFlashcardsTable(
  { getDb },
  { postRevlogBatch: postClearBacklogRevlogs }
);
export const progressTable = makeProgressTable({ getDb });
export const settingsTable = makeSettingsTable({ getDb });
