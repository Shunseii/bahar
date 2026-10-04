import { recoverFromSyncConflict, type SyncOutcome } from "@bahar/db-core";
import { enqueueSyncOperation } from "@bahar/db-operations";
import * as Sentry from "@sentry/react-native";
import { dbPlatform, ensureDb, syncDb } from "@/lib/db";
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

/**
 * Routes the sync through the shared queue so pull/push serializes with local
 * writes -- they never overlap -- and concurrent sync requests merge into one
 * in-flight run.
 *
 * enqueueSyncOperation resolves void, so the outcome is carried out through a
 * local rather than returned. Reading it behind this function's annotated
 * return type also stops the compiler narrowing it to the initial value, which
 * it cannot see the callback reassign. "ok" stands for the merged case, where
 * the queue folded this run into an in-flight one and the body never ran.
 */
const runQueuedSync = async (): Promise<SyncOutcome> => {
  let outcome: SyncOutcome = { outcome: "ok" };

  await enqueueSyncOperation(async () => {
    outcome = await syncDb();
  });

  return outcome;
};

/**
 * A sync failure never breaks the open replica, so a transient one is logged
 * and left for the next tick. Only a conflict or an unrecoverable failure is
 * worth an error event -- and the wipe behind a conflict runs only when
 * `shouldRecoverFromConflict` allows it (BAHAR-MOBILE-2: never while offline).
 */
const reportSyncFailure = async (outcome: SyncOutcome) => {
  if (outcome.outcome === "ok") return;

  const kind =
    outcome.outcome === "degraded" ? outcome.classification.kind : "permanent";

  console.warn("[sync] Sync failed:", outcome.error.reason);

  if (kind === "transient") {
    Sentry.logger.warn("periodic sync failed (transient)", {
      reason: outcome.error.reason,
    });
    return;
  }

  Sentry.captureException(
    new Error(outcome.error.type, { cause: outcome.error }),
    {
      fingerprint: ["periodic-sync-failed"],
      contexts: {
        sync: {
          syncConflict: kind === "conflict",
          reason: outcome.error.reason,
        },
      },
    }
  );

  const recovery = await recoverFromSyncConflict({
    platform: dbPlatform,
    syncOutcome: outcome,
  });

  if (!recovery.recovered && recovery.reason === "offline") {
    Sentry.logger.warn(
      "sync conflict while offline -- keeping local replica, deferring wipe"
    );
  }
};

export const performSync = async () => {
  store.set(isSyncingAtom, true);
  // Set once reportSyncFailure has already told Sentry about this failure, so
  // the catch below doesn't file it a second time under the same fingerprint.
  let reported = false;
  try {
    const maxTsBefore = await getMaxTimestamp();
    const countBefore = await getEntryCount();

    const outcome = await runQueuedSync();

    if (outcome.outcome !== "ok") {
      await reportSyncFailure(outcome);
      reported = true;
      // Keep rejecting: pull-to-refresh in DictionaryList falls back to a
      // local refresh when a sync fails, and decks/settings await this too.
      throw new Error(outcome.error.type, { cause: outcome.error });
    }

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
    if (!reported) {
      console.warn("[sync] Sync failed:", error);
      // The periodic sync caller swallows this rejection, so capture here or
      // it's invisible. captureException on the raw error preserves the
      // native stack.
      Sentry.captureException(error, {
        fingerprint: ["periodic-sync-failed"],
        contexts: { sync: { syncConflict: false } },
      });
    }
    throw error;
  } finally {
    store.set(isSyncingAtom, false);
  }
};
