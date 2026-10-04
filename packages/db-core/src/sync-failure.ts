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

/**
 * Error types that are transient by construction, whatever their reason
 * text happens to say. Both are network fetches made around an otherwise
 * healthy replica: `get_db_info_failed` is the connection-info call and
 * `api_schema_verification_failed` the migrations-API call (BAHAR-WEB-38).
 *
 * Checked before the reason patterns because the reason is prose produced
 * by the engine or the fetch layer, and a reword there must not silently
 * reclassify a known-transient failure as permanent.
 */
const TRANSIENT_ERROR_TYPES = [
  "get_db_info_failed",
  "api_schema_verification_failed",
];

export const classifySyncFailure = ({
  error,
  isSyncError,
}: {
  error: DbError;
  isSyncError: (reason: string) => boolean;
}): SyncFailureClassification => {
  const reason = error.reason ?? error.type;
  if (isSyncError(reason)) return { kind: "conflict" };

  if (TRANSIENT_ERROR_TYPES.includes(error.type)) return { kind: "transient" };

  if (isTransientNetworkFailure(reason)) return { kind: "transient" };

  return { kind: "permanent", error };
};

/**
 * The engine's conflict variant, as both sync-wasm and sync-react-native
 * render it. Its error enum is
 * `TursoError | DatabaseTapeError | JsonDecode | DatabaseSyncEngineError |
 * DatabaseSyncEngineConflict | IoError`, and only the conflict variant means
 * local and remote frames have diverged:
 *
 * - `database sync engine error` is any sync failure, network included.
 * - `database tape error` is the change-log layer (poisoned CDC rows).
 * - `database sync engine conflict` is the real thing.
 *
 * Matched on the full phrase deliberately. A looser check also catches
 * `fsync error (data_sync_retry=off)` -- a disk fault -- and routing that
 * into destructive recovery would wipe a replica over a failed write.
 */
const SYNC_CONFLICT_MARKER = "database sync engine conflict";

export const isSyncConflictError = (reason: string): boolean =>
  reason.toLowerCase().includes(SYNC_CONFLICT_MARKER);
