import { enqueueSyncOperation } from "@bahar/db-operations";
import * as Sentry from "@sentry/react-native";
import { ensureDb, recoverFromSyncConflict } from "@/lib/db";
import { isSyncError, syncDatabase } from "@/lib/db/adapter";
import {
  dictionaryChangedAtom,
  isSyncingAtom,
  store,
  syncCompletedCountAtom,
} from "@/lib/store";

const getEntryCount = async (): Promise<number> => {
  const db = await ensureDb();
  const result = await db
    .prepare<{ cnt: number }>("SELECT COUNT(*) as cnt FROM dictionary_entries")
    .get();
  return result?.cnt ?? 0;
};

const getMaxTimestamp = async (): Promise<number | null> => {
  const db = await ensureDb();
  const result = await db
    .prepare<{ max_ts: number | null }>(
      "SELECT MAX(updated_at_timestamp_ms) as max_ts FROM dictionary_entries"
    )
    .get();
  return result?.max_ts ?? null;
};

export const performSync = async () => {
  store.set(isSyncingAtom, true);
  try {
    const maxTsBefore = await getMaxTimestamp();
    const countBefore = await getEntryCount();

    // Route through the shared queue so sync (pull/push) serializes with local
    // writes on the single DB queue -- they never overlap -- and concurrent
    // sync requests merge into one in-flight run.
    await enqueueSyncOperation(() => syncDatabase());

    const maxTsAfter = await getMaxTimestamp();
    const countAfter = await getEntryCount();
    const changed = maxTsBefore !== maxTsAfter || countBefore !== countAfter;

    if (changed) {
      store.set(dictionaryChangedAtom, true);
    }

    store.set(syncCompletedCountAtom, (c) => c + 1);
    console.log("[sync] Sync complete", {
      dictionaryChanged: changed,
      countBefore,
      countAfter,
      maxTsBefore,
      maxTsAfter,
    });
    Sentry.logger.info("periodic sync complete", {
      dictionaryChanged: changed,
      countBefore,
      countAfter,
    });
  } catch (error) {
    console.warn("[sync] Sync failed:", error);
    // The periodic sync caller swallows this rejection, so capture here or it's
    // invisible. captureException on the raw error preserves the native stack.
    const syncConflict = isSyncError(error);
    Sentry.captureException(error, {
      fingerprint: ["periodic-sync-failed"],
      contexts: { sync: { syncConflict } },
    });
    if (syncConflict) {
      await recoverFromSyncConflict();
    }
    throw error;
  } finally {
    store.set(isSyncingAtom, false);
  }
};
