import { type Result, tryCatch } from "@bahar/result";
import {
  classifySyncFailure,
  isTransientNetworkFailure,
  type SyncFailureClassification,
} from "./sync-failure";

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
 * Whether the platform considers a thrown error a sync-protocol conflict --
 * the engine's `database sync engine conflict`, not its generic
 * `database sync engine error`. See isSyncConflictError.
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
  /**
   * Deletes the local replica and its sidecar state. Destructive: anything
   * in the change log that has not pushed yet goes with it.
   */
  deleteLocalReplica: () => Promise<void> | void;
  /**
   * Restarts the app so the engine re-inits against a fresh replica. The
   * native/wasm engine keeps state a reconnect alone will not clear.
   */
  restart: (reason: string) => Promise<void>;
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
 * How many times a network-only init stage is reattempted, and how long to
 * wait between tries.
 *
 * Only the stages that are pure network calls retry: fetching connection
 * info, the first pull, and the migrations-API fetch. Nothing that has
 * already executed SQL is ever repeated.
 */
export type RetryPolicy = {
  /** Total attempts including the first. 1 disables retrying. */
  attempts: number;
  /** Delay before the nth retry, 1-based. */
  delayMs: (attempt: number) => number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  delayMs: (attempt) => 200 * 2 ** (attempt - 1),
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reattempts `operation` while the failure looks like a transient network
 * fault. A 401 is never retried -- the credentials will not improve -- and
 * neither is anything whose reason does not read as a network problem, since
 * repeating a schema or lock failure just delays the same error.
 */
const retryTransientThrow = async <T>({
  operation,
  policy,
}: {
  operation: () => Promise<T>;
  policy: RetryPolicy;
}): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const worthRetrying =
        attempt < policy.attempts &&
        !isUnauthorizedApiError(error) &&
        isTransientNetworkFailure(String(error));

      if (!worthRetrying) break;

      await sleep(policy.delayMs(attempt));
    }
  }

  throw lastError;
};

/**
 * Reattempts the migrations step, but only while it is failing on its API
 * fetch (`api_schema_verification_failed`), which happens before any
 * migration SQL runs. Once execution has started a retry could double-apply
 * a partially-applied migration, so every other failure is returned as-is.
 */
const retryMigrationsFetch = async ({
  applyRequiredMigrations,
  policy,
}: {
  applyRequiredMigrations: () => Promise<Result<unknown, DbError>>;
  policy: RetryPolicy;
}): Promise<Result<unknown, DbError>> => {
  let result = await applyRequiredMigrations();

  for (let attempt = 1; attempt < policy.attempts; attempt++) {
    if (result.ok) return result;
    if (result.error.type !== "api_schema_verification_failed") return result;

    await sleep(policy.delayMs(attempt));
    result = await applyRequiredMigrations();
  }

  return result;
};

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
 *   Carries the `classification` so the caller can route a conflict to
 *   the conflict-recovery policy and let a transient pass quietly.
 *
 * There is no fatal variant. A sync runs against an already-open replica,
 * so failing cannot take it away -- and a failure no retry can fix already
 * arrives as `classification: permanent`. Unlike DbInitOutcome, which does
 * have `err`, there is no state here where the caller has nothing to fall
 * back to.
 */
export type SyncOutcome =
  | { outcome: "ok" }
  | {
      outcome: "degraded";
      error: DbError;
      classification: SyncFailureClassification;
    };

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
    retry?: RetryPolicy;
  }
): Promise<DbInitOutcome> => {
  const policy = options.retry ?? DEFAULT_RETRY_POLICY;

  const infoResult = await tryCatch(
    () =>
      retryTransientThrow({ operation: platform.getConnectionInfo, policy }),
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
    () => retryTransientThrow({ operation: platform.pull, policy }),
    (error): DbError => ({
      type: "turso_db_pull_failed",
      ...describeError(error),
    })
  );

  const migrationResult = await retryMigrationsFetch({
    applyRequiredMigrations: options.applyRequiredMigrations,
    policy,
  });

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

  const classification = classifySyncFailure({
    error: syncResult.error,
    isSyncError: platform.isSyncError,
  });
  return { outcome: "degraded", error: syncResult.error, classification };
};
