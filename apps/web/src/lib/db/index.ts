import {
  classifySyncFailure,
  type DbConnectionInfo,
  type DbError,
  type DbPlatform,
  isSyncConflictError,
  runDbInit,
  runSync,
  type SyncOutcome,
} from "@bahar/db-core";
import { configureDbQueue } from "@bahar/db-operations";
import type { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import * as schema from "@bahar/drizzle-user-db-schemas";
import { err, ok, type Result, tryCatch } from "@bahar/result";
import * as Sentry from "@sentry/react";
import { connect, type Database } from "@tursodatabase/sync-wasm/vite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { api } from "../api";
import { DbInitFailedError } from "./errors";

// Wire web's Sentry logger into the shared DB queue (which has no logging
// dependency of its own). Done here because every DB path -- operations and
// sync alike -- initializes through this module's ensureDb, so the handlers
// are always set before any queued operation runs.
configureDbQueue({
  onError: (error) => {
    Sentry.logger.error("Database queue operation failed", {
      error: String(error),
    });
  },
  onInfo: (message) => {
    Sentry.logger.info(message);
  },
});

/**
 * Serializes an arbitrary thrown value into a Sentry-friendly shape. `String(error)`
 * alone collapses wasm/Turso errors to opaque one-liners (e.g. "RuntimeError:
 * unreachable") and drops the stack, so this preserves name/stack/cause -- for a
 * wasm trap the stack carries the `wasm://` frames that name the failing engine
 * function.
 */
const describeError = (error: unknown) => ({
  reason: String(error),
  name: error instanceof Error ? error.name : typeof error,
  stack: error instanceof Error ? error.stack : undefined,
  cause:
    error instanceof Error && error.cause != null
      ? String(error.cause)
      : undefined,
});

/**
 * A stale bundle running an older sync-wasm writes change-log entries using the
 * older column layout. Every value lands one column off, so `table_name` (text)
 * ends up in `change_type` -- and SQLite stores it as text regardless of the
 * column's declared INTEGER type, so the write succeeds silently. The current
 * engine then can't parse the entry, and since it can never be drained, every
 * later push fails on it too. Sync stays broken across releases until the entry
 * is removed.
 *
 * The class covers more than that corruption (a malformed payload reports the
 * same way), so a match only means "worth attempting a repair", not "repairable".
 */
const POISONED_CHANGE_LOG_ERROR = "database tape error";

const isPoisonedChangeLogError = (reason: string) =>
  reason.includes(POISONED_CHANGE_LOG_ERROR);

/**
 * Removes only the malformed entries, so well-formed pending changes queued
 * behind them still push. `typeof()` reports a value's real storage class rather
 * than the column's declared type, which identifies exactly the rows written
 * under the wrong layout.
 *
 * Writes made during the stale-bundle session go with those entries, and
 * deletions from it reappear on the next pull. Both are bounded to that one
 * session. No user table is touched.
 *
 * Returns whether anything was removed, so the caller only retries a sync that
 * has a reason to now succeed.
 */
const repairPoisonedChangeLog = async () => {
  if (!db) return false;

  const result = await tryCatch(
    async () => {
      const before: { n: number } | undefined = await db!.get(
        "SELECT COUNT(*) AS n FROM turso_cdc WHERE typeof(change_type) != 'integer';"
      );
      const poisoned = before?.n ?? 0;
      if (poisoned === 0) return 0;

      await db!.run(
        "DELETE FROM turso_cdc WHERE typeof(change_type) != 'integer';"
      );
      return poisoned;
    },
    (error) => ({
      type: "change_log_repair_failed",
      ...describeError(error),
    })
  );

  if (!result.ok) {
    Sentry.captureException(
      new Error(result.error.type, { cause: result.error }),
      { fingerprint: ["db-init-error", result.error.type] }
    );
    return false;
  }

  Sentry.logger.info("Repaired poisoned change log", { removed: result.value });

  return result.value > 0;
};

/**
 * Records the browser storage/runtime environment as Sentry context. This is the
 * layer with the least visibility for local-DB failures -- OPFS support, storage
 * quota/pressure, install mode (PWA standalone vs browser tab), cross-origin
 * isolation, and device memory are the usual suspects behind sync-wasm `connect()`
 * traps that only reproduce on some devices. Attached to every subsequent event.
 */
const setStorageEnvContext = async () => {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;

  // Without this the origin is "best-effort" storage, which the browser may
  // evict wholesale under device storage pressure -- taking the OPFS db with
  // it. Writes that haven't synced yet exist nowhere else, so that loss is
  // permanent. Chrome grants this silently for installed PWAs and high
  // engagement rather than prompting; a denial just leaves us where we were.
  const persistGranted =
    (await navigator.storage?.persist?.().catch(() => null)) ?? null;

  Sentry.setContext("storage_env", {
    displayMode: standalone ? "standalone" : "browser",
    opfsSupported: typeof navigator.storage?.getDirectory === "function",
    persistGranted,
    persisted:
      (await navigator.storage?.persisted?.().catch(() => null)) ?? null,
    quota: estimate?.quota ?? null,
    usage: estimate?.usage ?? null,
    deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    crossOriginIsolated: window.crossOriginIsolated,
    online: navigator.onLine,
    userAgent: navigator.userAgent,
  });
};

/**
 * Best-effort check of whether the local OPFS db file already exists, to
 * distinguish a first-run create from a reconnect in init logs. Returns null if
 * OPFS can't be enumerated -- itself a useful signal, since a browser without
 * usable OPFS is a prime suspect for connect traps.
 */
const localDbExists = async (dbName: string) => {
  try {
    const fileName = _formatLocalDbName(dbName);
    const root = await navigator.storage.getDirectory();
    for await (const [name] of root as unknown as AsyncIterable<
      [string, FileSystemHandle]
    >) {
      if (name === fileName) return true;
    }
    return false;
  } catch {
    return null;
  }
};

/**
 * Singleton handle to the local copy of the user's database, which syncs with
 * the remote Turso database. This is a direct in-tab sync-wasm `Database`,
 * exposing the prepare/exec/pull/push/close surface.
 *
 * Initially null; initialized in the pre-load of the authorized route.
 */
let db: Database | null = null;
let dbInitPromise: ReturnType<typeof _initDbInternal> | null = null;

let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

const LOCAL_DB_PATH_PREFIX = "bahar-local";

/**
 * Builds the drizzle sqlite-proxy adapter around a sync-wasm `Database`.
 * There's no first-party drizzle driver for `@tursodatabase/sync-wasm`,
 * so this translates drizzle's generic query calls into the db's own
 * prepare/run/all/get API. Shared with the test harness so both stay
 * in sync with the same query/row-mapping behavior.
 *
 * Rows come back name-keyed, matched to the query's compiled column names --
 * drizzle doesn't emit SQL aliases to guarantee those names are unique
 * across a join. Any query selecting plain columns from both sides of a
 * join into the same output (e.g. both flashcards.id and
 * dictionaryEntries.id, both literally "id") must alias the colliding one
 * explicitly via `sql<T>\`column\`.as("uniqueName")`, or the duplicate name
 * silently collapses and misaligns every value after it.
 */
const execute = async (
  db: Database,
  sql: string,
  params: unknown[],
  method: string
) => {
  const stmt = await db.prepare(sql);

  if (method === "run") {
    await stmt.run(params);
    return { rows: [] };
  }

  if (method === "all" || method === "values") {
    const rows = (await stmt.all(params)) as Record<string, unknown>[];
    return { rows: rows.map((row) => Object.values(row)) };
  }

  if (method === "get") {
    const row = (await stmt.get(params)) as Record<string, unknown> | null;
    return { rows: row ? Object.values(row) : [] };
  }

  return { rows: [] };
};

export const buildDrizzleDb = (getDb: () => Database | null) =>
  drizzle(
    async (sql, params, method) => {
      const db = getDb();
      if (!db) return { rows: [] };

      return execute(db, sql, params, method);
    },
    // Routes drizzle's `.batch()` through sync-wasm's own transaction, so a
    // multi-statement operation either lands whole or not at all. Statements
    // run in order; the engine rolls back if any of them throws.
    async (queries) => {
      const db = getDb();
      if (!db) return queries.map(() => ({ rows: [] }));

      const runBatch = db.transaction(async () => {
        const results: { rows: unknown[] }[] = [];

        for (const { sql, params, method } of queries) {
          results.push(await execute(db, sql, params, method));
        }

        return results;
      });

      return runBatch();
    },
    { schema }
  );

export const getDrizzleDb = () => {
  if (!drizzleDb) {
    throw new Error("Database not initialized.");
  }

  return drizzleDb;
};

export const getDb = () => {
  if (!db) {
    throw new Error("Database not initialized.");
  }

  return db;
};

/**
 * Ensures the database is initialized before returning it.
 * Use this in DB operations to handle cases where the DB
 * was closed (e.g., after visibility change).
 */
export const ensureDb = async () => {
  const result = await initDb();
  if (!result.ok) {
    throw new DbInitFailedError({ dbErrorType: result.error.type });
  }
  return getDb();
};

/**
 * Why resetDb ran. `hadLiveDb: true` in the log means a live connection was
 * closed -- the dangerous case, since it releases the OPFS SyncAccessHandle
 * out from under any in-flight reads.
 */
type ResetDbCaller = "logout" | "unauthorized_redirect" | "delete_local_db";

export const resetDb = async (caller: ResetDbCaller) => {
  Sentry.logger.info("resetDb called", { caller, hadLiveDb: db != null });

  if (db) {
    await db.close();
    db = null;
    dbInitPromise = null;
  }

  if (drizzleDb) {
    drizzleDb = null;
  }
};

/**
 * Deletes all local OPFS databases and Turso sync metadata from localStorage.
 * Use this to recover from corrupted sync state or schema conflicts.
 *
 * Note: It's important to clear both opfs and localStorage otherwise
 * the data will be in a worse state.
 */
export const deleteLocalDatabase = async () => {
  await resetDb("delete_local_db");

  // OPFS files and localStorage sync metadata live in this context.
  const opfsRoot = await navigator.storage.getDirectory();

  const filesToDelete: string[] = [];
  // Cast needed because TypeScript's lib doesn't include entries() for FileSystemDirectoryHandle
  for await (const [name] of opfsRoot as unknown as AsyncIterable<
    [string, FileSystemHandle]
  >) {
    if (name.startsWith(LOCAL_DB_PATH_PREFIX)) {
      filesToDelete.push(name);
    }
  }

  for (const fileName of filesToDelete) {
    try {
      await opfsRoot.removeEntry(fileName);
    } catch {
      // File might be locked, ignore
    }
  }

  // Delete Turso sync metadata from localStorage
  const keysToDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LOCAL_DB_PATH_PREFIX)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    localStorage.removeItem(key);
  }
};

/**
 * Initializes connection to the user's database
 * by querying the server for the connection information
 * then either creating or connecting to a local copy
 * of the database.
 *
 * Also runs an initial sync with remote and any new migrations.
 *
 * Uses a promise-based singleton pattern to prevent race conditions
 * if called concurrently before initialization completes.
 */
/**
 * The sync-wasm side of the db-core boundary. Module-scoped because both
 * init and the periodic sync loops run against the same live connection --
 * `connect` takes its info as an argument, so nothing here closes over
 * per-call state.
 *
 * Conflict detection is live, but web deliberately does not act on it yet:
 * the sync loop reports a conflict and leaves the replica alone. Wiping is
 * lossy -- unpushed turso_cdc rows go with it -- and the engine over-declares
 * conflicts by design, so web arms the destructive path only once there is
 * real data showing conflicts happen here at all.
 */
const dbPlatform: DbPlatform = {
  getConnectionInfo: async (): Promise<DbConnectionInfo> => {
    const { data, error } = await api.databases.user.get();
    if (error) throw error;
    return data;
  },
  connect: async (info: DbConnectionInfo) => {
    const dbAlreadyExists = await localDbExists(info.db_name);
    Sentry.logger.info("initDb: fetched db info", {
      dbName: info.db_name,
      hostname: info.hostname,
      dbAlreadyExists,
    });

    const connected = await _connectToLocalDb({
      hostname: info.hostname,
      authToken: info.access_token,
      dbName: info.db_name,
    });

    db = connected;
    drizzleDb = buildDrizzleDb(() => db);

    Sentry.logger.info("initDb: connected to local db");
  },
  pull: async () => {
    await db!.pull();
  },
  push: async () => {
    await db!.push();
  },
  isSyncError: (error: unknown) => isSyncConflictError(String(error)),
  isOffline: () => !navigator.onLine,
  deleteLocalReplica: () => deleteLocalDatabase(),
  restart: async (reason: string) => {
    Sentry.logger.warn("recovery: restarting after wipe", { reason });
    window.location.reload();
  },
};

/**
 * One pull+push cycle against the open replica, shared by the background
 * and visibility sync loops. Returns the outcome rather than throwing: a
 * failed sync leaves the replica usable, so the caller logs and waits for
 * the next tick instead of surfacing anything.
 *
 * Requires an open connection -- call `ensureDb()` first.
 */
export const syncDb = async (): Promise<SyncOutcome> => runSync(dbPlatform);

export const initDb = async () => {
  if (db) return ok(null);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = _initDbInternal();
  const result = await dbInitPromise;
  if (!result.ok) {
    dbInitPromise = null; // Allow retry on failure
    reportDbInitFailure(result.error);
  }
  return result;
};

/**
 * The one place a db-init failure is reported.
 *
 * Every path funnels through initDb, so capturing here covers the failures
 * the route boundary never sees -- a query calling ensureDb outside a route
 * load, for instance. Reporting at the route instead left those invisible,
 * and reporting at both filed every failure twice.
 */
const reportDbInitFailure = (error: DbError) => {
  Sentry.logger.warn("initDb failed", {
    outcome: error.type,
    reason: error.reason ?? null,
  });

  // BAHAR-WEB-38: classification so "no transient failure reaches the error
  // page" is measurable. isSyncError is false here because web reports
  // conflicts rather than recovering from them.
  const retryable =
    classifySyncFailure({ error, isSyncError: () => false }).kind ===
    "transient";

  Sentry.captureException(new Error(error.type, { cause: error }), {
    fingerprint: ["db-init-error", error.type],
    tags: { retryable: retryable ? "true" : "false" },
    contexts: {
      db_init: {
        type: error.type,
        reason: error.reason ?? null,
        retryable,
        // Preserved from the underlying throw -- for a wasm trap the stack
        // carries the `wasm://` frames that String(error) would drop.
        name: error.name ?? null,
        stack: error.stack ?? null,
        cause: error.cause ?? null,
        wasmTrap: error.wasmTrap ?? null,
        migrationVersion: error.migrationVersion ?? null,
      },
    },
  });
};

const _initDbInternal = async (): Promise<Result<null, DbError>> => {
  Sentry.logger.info("initDb: start");
  await setStorageEnvContext();

  // The poisoned-change-log repair is web-specific, so it wraps the
  // state machine's final sync step rather than living in db-core.
  const outcome = await runDbInit(dbPlatform, {
    applyRequiredMigrations,
  });

  if (outcome.outcome === "degraded") {
    if (isPoisonedChangeLogError(outcome.error.reason ?? "")) {
      const repaired = await repairPoisonedChangeLog();

      if (repaired) {
        const retry = await runDbInit(dbPlatform, {
          applyRequiredMigrations,
        });
        Sentry.logger.info("initDb: sync retried after change-log repair", {
          ok: retry.outcome === "ok",
        });
        if (retry.outcome === "ok") return ok(null);
        if (retry.outcome === "degraded") {
          reportDegradedDb(retry.error);
          return ok(null);
        }
        return err(retry.error);
      }
    }

    reportDegradedDb(outcome.error);
    return ok(null);
  }

  if (outcome.outcome === "err") {
    return err(outcome.error);
  }

  Sentry.logger.info("initDb: success");
  return ok(null);
};

/**
 * True after the last initDb completed with a usable-but-stale local
 * replica (initial sync failed, e.g. a transient network fault). Read
 * by the authorized layout to show a non-blocking offline indicator
 * instead of the error page (BAHAR-WEB-38).
 */
let dbDegraded = false;
export const isDbDegraded = () => dbDegraded;

const reportDegradedDb = (error: DbError) => {
  dbDegraded = true;
  Sentry.logger.warn("initDb: degraded -- using stale local replica", {
    outcome: error.type,
    reason: error.reason,
  });
};

/**
 * Executes any required migrations on the user database.
 * If a migration fails, it doesn't apply the rest.
 *
 * Records which migrations were applied in the database.
 * If there are any errors when recording the applied migrations,
 * it logs it in Sentry then continues applying the rest.
 *
 * If the latest migration is failing, it does not run
 * the rest of the migrations, if any.
 *
 * Note: all migrations must be idempotent otherwise
 * this logic will cause issues.
 */
const applyRequiredMigrations = async () => {
  if (!db) return ok(null);

  const allMigrationsResult = await tryCatch(
    async () => {
      const { data, error } = await api.migrations.full.get();
      if (error) throw error;
      return data;
    },
    (error) => ({
      type: "api_schema_verification_failed",
      ...describeError(error),
    })
  );
  if (!allMigrationsResult.ok) return allMigrationsResult;

  const allMigrations = allMigrationsResult.value;
  if (!allMigrations.length) return ok(null);

  const localMigrationsResult = await getLocalAppliedMigrations();
  if (!localMigrationsResult.ok) return localMigrationsResult;

  const appliedVersions = new Set(
    localMigrationsResult.value
      .filter((m) => m.status === "applied")
      .map((m) => m.version)
  );

  const migrationsLength = localMigrationsResult.value.length;
  const lastMigrationFailed =
    migrationsLength > 0 &&
    localMigrationsResult.value[migrationsLength - 1].status === "failed";

  if (lastMigrationFailed) {
    return err({
      type: "latest_migration_is_failing",
      reason:
        "The last migration failed. Must be fixed manually before proceeding.",
    });
  }

  const requiredMigrations = allMigrations
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version);

  if (!requiredMigrations.length) return ok(null);

  Sentry.logger.info("initDb: applying migrations", {
    count: requiredMigrations.length,
    versions: requiredMigrations.map((m) => m.version),
  });

  for (const migration of requiredMigrations) {
    const nowTimestampMs = Date.now();

    Sentry.logger.info("initDb: applying migration", {
      version: migration.version,
      description: migration.description,
    });

    const execResult = await tryCatch(
      () => db!.exec(migration.sql_script),
      (error) => ({
        type: "migration_failed",
        migrationVersion: migration.version,
        migrationDescription: migration.description,
        ...describeError(error),
      })
    );

    if (!execResult.ok) {
      Sentry.logger.error("initDb: migration exec failed", {
        version: migration.version,
        reason: execResult.error.reason,
      });

      await tryCatch(
        () =>
          db!.run(
            "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
            [migration.version, migration.description, nowTimestampMs, "failed"]
          ),
        (error) => {
          Sentry.logger.error("Failed to log failed migration", {
            migrationVersion: migration.version,
            reason: String(error),
          });
          return null;
        }
      );

      return execResult;
    }

    await tryCatch(
      () =>
        db!.run(
          "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
          [migration.version, migration.description, nowTimestampMs, "applied"]
        ),
      (error) => {
        Sentry.logger.error("Failed to log successful migration", {
          migrationVersion: migration.version,
          reason: String(error),
        });
        return null;
      }
    );
  }

  return ok(null);
};

const getLocalAppliedMigrations = async () => {
  if (!db) return err({ type: "db_not_initialized" });

  const tableExists = await tryCatch(
    async () => {
      const result = await db!.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';"
      );
      return !!result;
    },
    (error) => ({
      type: "check_migration_table_exists_query_failed",
      ...describeError(error),
    })
  );

  if (!tableExists.ok) return tableExists;
  if (!tableExists.value) return ok([] as SelectMigration[]);

  return tryCatch(
    async () => {
      const rows: SelectMigration[] = await db!.all(
        "SELECT * FROM migrations;"
      );
      return rows;
    },
    (error) => ({
      type: "local_migrations_query_failed",
      ...describeError(error),
    })
  );
};

const _formatDbUrl = (hostname: string) => `libsql://${hostname}`;

const _formatLocalDbName = (dbName: string) =>
  `${LOCAL_DB_PATH_PREFIX}-${dbName}.db`;

/**
 * Opens the local user DB as a direct in-tab sync-wasm connection. The DB is
 * owned by whichever tab opens it; a second tab opening the same DB will hit the
 * browser-wide OPFS SyncAccessHandle lock and surface an `opfs_lock_error`,
 * which the caller handles with a "close other tabs" message.
 */
const _connectToLocalDb = async ({
  hostname,
  authToken,
  dbName,
}: {
  hostname: string;
  authToken: string;
  dbName: string;
}): Promise<Database> => {
  return connect({
    path: _formatLocalDbName(dbName),
    url: _formatDbUrl(hostname),
    authToken,
  });
};
