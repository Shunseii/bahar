import { type Result, tryCatch } from "@bahar/result";

/**
 * Connection info for the user's remote database, fetched from the API
 * (`api.databases.user.get` on both platforms).
 */
export type DbConnectionInfo = {
  access_token: string;
  hostname: string;
  db_name: string;
};

/**
 * Discriminated by `type`, matching the error variants both platforms
 * already produce in their `_initDbInternal`/`runSync` catch blocks.
 * Kept structurally compatible so platforms can pass their existing
 * error objects through without mapping.
 */
export type DbError = {
  type: string;
  reason?: string;
  name?: string;
  stack?: string;
  cause?: string;
  wasmTrap?: boolean;
  migrationVersion?: number;
};

/**
 * Whether the platform considers a thrown error a sync-protocol conflict
 * (sync-wasm/sync-react-native "sync error") that may require recovery.
 */
export type IsSyncError = (error: unknown) => boolean;

const isUnauthorizedApiError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 401
  );
};

/**
 * The platform boundary. Everything here is what differs between
 * sync-wasm (web) and sync-react-native (mobile); the orchestration
 * logic in this package only depends on this shape.
 *
 * For fault-injection tests, pass a fake whose connect/pull/push
 * throw on demand.
 */
export type DbPlatform = {
  /** Fetches remote connection info. Network call. */
  getConnectionInfo: () => Promise<DbConnectionInfo>;
  /**
   * Opens (creating if needed) the local replica connected to the
   * remote. May do network I/O and may fail on OPFS lock / wasm trap /
   * native connect errors.
   */
  connect: (info: DbConnectionInfo) => Promise<void>;
  /** Pulls remote changes into the local replica. Network call. */
  pull: () => Promise<void>;
  /** Pushes local changes to the remote. Network call. */
  push: () => Promise<void>;
  /** Whether a thrown value is a sync-protocol conflict. */
  isSyncError: IsSyncError;
  /**
   * Best-effort report of whether the device is currently offline.
   * Used to avoid destructive recovery when connectivity, not
   * corruption, is the problem.
   */
  isOffline: () => boolean;
};

const describeError = (error: unknown): Omit<DbError, "type"> => ({
  reason: String(error),
  name: error instanceof Error ? error.name : typeof error,
  stack: error instanceof Error ? error.stack : undefined,
  cause:
    error instanceof Error && error.cause != null
      ? String(error.cause)
      : undefined,
});

const reasonOf = (error: { reason?: string; type?: string }): string =>
  error.reason ?? error.type ?? "unknown";

/**
 * Outcome of a db-init run.
 *
 * - `ok`: fully initialized and synced.
 * - `degraded`: local replica is open and usable, but the initial
 *   sync with remote failed. The user works against a possibly
 *   stale replica; the caller shows a non-blocking indicator.
 *   This is the outcome that used to bubble up as a blocking
 *   error page for transient network failures (BAHAR-WEB-38).
 * - `err`: unusable -- nothing the caller can do but show the
 *   blocking error page.
 */
export type DbInitOutcome =
  | { outcome: "ok" }
  | { outcome: "degraded"; error: DbError }
  | { outcome: "err"; error: DbError };

/**
 * Outcome of a periodic/background sync run (distinct from init).
 *
 * - `ok`: pull+push succeeded.
 * - `degraded`: sync failed but the local replica remains usable.
 *   Includes `conflict: true` when the failure is a sync conflict,
 *   so the caller can route to conflict-recovery policy.
 * - `err`: sync failed and the replica itself is broken.
 */
export type SyncOutcome =
  | { outcome: "ok" }
  | { outcome: "degraded"; error: DbError; conflict: boolean }
  | { outcome: "err"; error: DbError };

/**
 * The db-init state machine. Mirrors the sequence both platforms run
 * in `_initDbInternal` -- fetch info, connect, pull, migrate, pull+push
 * -- but centralizes the policy of *which failures are survivable*:
 *
 * 1. `getConnectionInfo` failure -> err unless 401 (err, unauthorized
 *    is handled by the caller; there is no local fallback for missing
 *    connection info on a cold start).
 * 2. `connect` failure -> err (no replica, nothing to degrade to).
 * 3. First `pull` failure -> degraded if connect succeeded (replica
 *    exists and is usable, just possibly stale).
 * 4. Migration failure -> err for schema-level failures, degraded
    when only the migrations API fetch failed transiently
    (BAHAR-WEB-38: api_schema_verification_failed used to bubble to
    the blocking error page after a successful connect+pull).
 * 5. Post-migration pull+push failure -> degraded.
 */
export const runDbInit = async (
  platform: DbPlatform,
  options: {
    applyRequiredMigrations: () => Promise<Result<unknown, DbError>>;
  }
): Promise<DbInitOutcome> => {
  const infoResult = await tryCatch(
    () => platform.getConnectionInfo(),
    (error): DbError =>
      isUnauthorizedApiError(error)
        ? { type: "unauthorized", ...describeError(error) }
        : { type: "get_db_info_failed", ...describeError(error) }
  );
  if (!infoResult.ok) return { outcome: "err", error: infoResult.error };

  const connectResult = await tryCatch(
    () => platform.connect(infoResult.value),
    (error): DbError => {
      const described = describeError(error);
      const reason = reasonOf(described);
      const isOpfsLock = reason.includes("createSyncAccessHandle");
      const wasmTrap =
        described.name === "RuntimeError" || reason.includes("unreachable");
      return {
        type: isOpfsLock ? "opfs_lock_error" : "db_connection_failed",
        wasmTrap,
        ...described,
      };
    }
  );
  if (!connectResult.ok) return { outcome: "err", error: connectResult.error };

  const firstPullResult = await tryCatch(
    () => platform.pull(),
    (error): DbError => ({
      type: "turso_db_pull_failed",
      ...describeError(error),
    })
  );

  const migrationResult = await options.applyRequiredMigrations();

  // A migration failure after a successful pull is schema-level: no
  // retry fixes it, block. But the very same migrations step includes
  // an API fetch (api.migrations.full.get) that can fail transiently
  // with a network error while the replica itself is fine
  // (BAHAR-WEB-38). Distinguish by classification: transient network
  // failures inside migrations degrade; the rest block.
  if (!migrationResult.ok) {
    const failure = migrationResult.error as DbError;
    if (failure.type !== "api_schema_verification_failed") {
      return { outcome: "err", error: failure };
    }
    // api_schema_verification_failed is the migrations API fetch;
    // degraded unless the first pull also failed, in which case the
    // aggregate is reported like before.
    if (firstPullResult.ok) return { outcome: "degraded", error: failure };
    return {
      outcome: "degraded",
      error: {
        type: "turso_remote_sync_and_pull_failed",
        reason: `Pull error: ${firstPullResult.error.reason}\nSync error: ${failure.reason}`,
      },
    };
  }

  if (!firstPullResult.ok) {
    // The initial pull failed after connect succeeded: the local
    // replica exists and is usable, just possibly stale. Attempt the
    // post-migration push so local writes aren't stranded, but even if
    // that fails the outcome stays degraded, not blocking.
    const syncResult = await tryCatch(
      async () => {
        await platform.pull();
        await platform.push();
      },
      (error): DbError => ({
        type: "turso_remote_sync_and_pull_failed",
        reason: `Pull error: ${firstPullResult.error.reason}\nSync error: ${String(error)}`,
      })
    );
    if (syncResult.ok) return { outcome: "ok" };
    return { outcome: "degraded", error: syncResult.error };
  }

  const syncResult = await tryCatch(
    async () => {
      await platform.pull();
      await platform.push();
    },
    (error): DbError => ({
      type: "turso_remote_sync_failed",
      ...describeError(error),
    })
  );
  if (!syncResult.ok) return { outcome: "degraded", error: syncResult.error };

  return { outcome: "ok" };
};

/**
 * A single pull+push cycle, as the periodic/background sync runs.
 * The local replica is already open; any failure here is by definition
 * non-fatal to the replica (except sync conflicts, which the caller
 * routes to conflict-recovery policy).
 */
export const runSync = async (platform: DbPlatform): Promise<SyncOutcome> => {
  const syncResult = await tryCatch(
    async () => {
      await platform.pull();
      await platform.push();
    },
    (error): DbError => ({
      type: "turso_remote_sync_failed",
      ...describeError(error),
    })
  );
  if (syncResult.ok) return { outcome: "ok" };

  const conflict = platform.isSyncError(syncResult.error.reason);
  return { outcome: "degraded", error: syncResult.error, conflict };
};

/**
 * Maps an init outcome to the equivalent sync outcome for callers that
 * treat init's final sync like any other sync (e.g. mobile's
 * recoverFromSyncConflict path after re-init).
 */
export const syncOutcomeFromInitOutcome = (
  initOutcome: DbInitOutcome
): SyncOutcome => {
  if (initOutcome.outcome === "ok") return { outcome: "ok" };
  return { outcome: "degraded", error: initOutcome.error, conflict: false };
};
