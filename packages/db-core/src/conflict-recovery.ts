import type { DbPlatform, SyncOutcome } from "./init";

/**
 * Policy for whether a sync conflict warrants destructive recovery
 * (wipe the local replica and re-pull from remote).
 *
 * The dangerous case is BAHAR-MOBILE-2: `recoverFromSyncConflict`
 * deletes the local replica, then restarts the app, which re-inits
 * by connecting and pulling -- all network operations. Offline, this
 * turns a sync conflict into a wipe with no data coming back until
 * connectivity returns, and the re-init itself fails. So:
 *
 * - Offline: never wipe. Keep the (conflicted, but locally intact)
 *   replica; the conflict likely can't even be diagnosed without a
 *   connection to the remote. Retry recovery on the next sync once
 *   back online.
 * - Online: wipe+reload remains the recovery, since a sync conflict
 *   means local and remote frames have diverged irrecoverably.
 */
export type SyncConflictPolicy = {
  /**
   * True when the caller should run destructive recovery
   * (delete local replica + restart). False means degrade: keep
   * local state and surface a non-blocking warning.
   */
  shouldRecover: boolean;
};

export const shouldRecoverFromConflict = ({
  platform,
  syncOutcome,
}: {
  platform: Pick<DbPlatform, "isOffline">;
  syncOutcome: SyncOutcome;
}): SyncConflictPolicy => {
  if (syncOutcome.outcome !== "degraded") return { shouldRecover: false };
  if (syncOutcome.classification.kind !== "conflict") {
    return { shouldRecover: false };
  }

  return { shouldRecover: !platform.isOffline() };
};

/**
 * Why recovery did or did not run. Returned rather than logged because
 * db-core has no reporting dependency -- each platform logs its own.
 */
export type ConflictRecoveryResult =
  | { recovered: true }
  | { recovered: false; reason: "not-a-conflict" | "offline" };

/**
 * Wipe the local replica and restart, when the policy allows it.
 *
 * Shared by both platforms: the primitives differ (OPFS + localStorage and a
 * page reload on web, replica files and an Expo reload on mobile) but the
 * sequence and the guard around it do not.
 */
export const recoverFromSyncConflict = async ({
  platform,
  syncOutcome,
}: {
  platform: Pick<DbPlatform, "isOffline" | "deleteLocalReplica" | "restart">;
  syncOutcome: SyncOutcome;
}): Promise<ConflictRecoveryResult> => {
  if (
    syncOutcome.outcome === "ok" ||
    syncOutcome.classification.kind !== "conflict"
  ) {
    return { recovered: false, reason: "not-a-conflict" };
  }

  if (platform.isOffline()) return { recovered: false, reason: "offline" };

  await platform.deleteLocalReplica();
  await platform.restart("Resolving sync conflict");

  return { recovered: true };
};
