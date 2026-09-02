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
  if (!syncOutcome.conflict) return { shouldRecover: false };

  return { shouldRecover: !platform.isOffline() };
};
