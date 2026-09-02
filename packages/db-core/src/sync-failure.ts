import type { DbError } from "./init";

/**
 * Classification of a sync-layer failure for the standing policy
 * "no transient failure reaches the error page" (gap 2 in the
 * telemetry audit).
 *
 * - `transient`: network-level failure (fetch, DNS, timeout, offline).
 *   Never a reason to block the UI; the replica stays usable.
 * - `conflict`: sync-protocol conflict; route to conflict-recovery
 *   policy.
 * - `permanent`: schema/migration/lock failures that no retry can
 *   fix; the blocking error page is legitimate here.
 */
export type SyncFailureClassification =
  | { kind: "transient" }
  | { kind: "conflict" }
  | { kind: "permanent"; error: DbError };

const TRANSIENT_REASON_PATTERNS = [
  "failed to fetch",
  "network",
  "timeout",
  "timed out",
  "dns",
  "offline",
  "connection refused",
  "connection reset",
  "econnrefused",
];

export const isTransientNetworkFailure = (reason: string): boolean => {
  const normalized = reason.toLowerCase();
  return TRANSIENT_REASON_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  );
};

export const classifySyncFailure = ({
  error,
  isSyncError,
}: {
  error: DbError;
  isSyncError: (reason: string) => boolean;
}): SyncFailureClassification => {
  const reason = error.reason ?? error.type;
  if (isSyncError(reason)) return { kind: "conflict" };

  if (isTransientNetworkFailure(reason)) return { kind: "transient" };

  return { kind: "permanent", error };
};
