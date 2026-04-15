import { recoverFromSyncConflict } from "@/lib/db";
import { isSyncError, syncDatabase } from "@/lib/db/adapter";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import {
  dictionaryChangedAtom,
  isSyncingAtom,
  store,
  syncCompletedCountAtom,
} from "@/lib/store";

export const performSync = async () => {
  store.set(isSyncingAtom, true);
  try {
    const maxTsBefore = await dictionaryEntriesTable.maxUpdatedAt.query();

    await syncDatabase();

    const maxTsAfter = await dictionaryEntriesTable.maxUpdatedAt.query();
    const changed = maxTsBefore !== maxTsAfter;

    if (changed) {
      store.set(dictionaryChangedAtom, true);
    }

    store.set(syncCompletedCountAtom, (c) => c + 1);
    console.log("[sync] Sync complete", { dictionaryChanged: changed });
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
