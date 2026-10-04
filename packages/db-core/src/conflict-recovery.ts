import type { DbPlatform, SyncOutcome } from "./init";

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
