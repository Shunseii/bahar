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

    await syncDatabase();

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
  } catch (error) {
    console.warn("[sync] Sync failed:", error);
    if (isSyncError(error)) {
      await recoverFromSyncConflict();
    }
    throw error;
  } finally {
    store.set(isSyncingAtom, false);
  }
};
