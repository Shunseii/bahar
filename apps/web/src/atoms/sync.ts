import { atom } from "jotai";

export const syncCompletedCountAtom = atom(0);

export const isSyncingAtom = atom(false);

/**
 * Epoch ms of the last sync that completed, or null if none has since the
 * page loaded.
 *
 * Set from the app's own sync loop rather than read back from the engine:
 * the engine exposes a lastPushUnixTime through stats(), but nothing calls
 * stats() today and the loop already knows when it succeeded.
 */
export const lastSyncedAtAtom = atom<number | null>(null);

/** Whether the browser reports no network connection. */
export const isOfflineAtom = atom(false);
