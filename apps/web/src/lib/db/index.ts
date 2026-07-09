import { configureDbQueue } from "@bahar/db-operations";
import type { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import * as schema from "@bahar/drizzle-user-db-schemas";
import { err, ok, tryCatch } from "@bahar/result";
import * as Sentry from "@sentry/react";
import { connect, type Database } from "@tursodatabase/sync-wasm/vite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { api } from "../api";
import { getDbWorkerClient, isSharedDbSupported } from "./worker/client";

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
 * Singleton handle to the local copy of the user's database, which syncs with
 * the remote Turso database. Depending on browser support this is either a
 * direct sync-wasm `Database` (fallback, single-tab) or a `Database`-shaped
 * proxy backed by the shared DB worker (multi-tab). Callers can't tell the
 * difference — both expose the same prepare/exec/pull/push/close surface.
 *
 * Initially null; initialized in the pre-load of the authorized route.
 */
let db: Database | null = null;
let dbInitPromise: ReturnType<typeof _initDbInternal> | null = null;

let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

const LOCAL_DB_PATH_PREFIX = "bahar-local";

/**
 * Kill switch for the shared-DB-across-tabs worker path (BAH-139).
 *
 * The `@tursodatabase/sync-wasm/bundle` build the dedicated worker uses spawns
 * an emscripten pthread worker and blocks the main WASM thread in `Atomics.wait`
 * until that pthread posts `loaded`. In the production Rollup build (minified,
 * nested worker emitted as a separate chunk, forced `type: "module"` via
 * vite.config `worker.format`) the pthread never completes that handshake, so
 * the worker never signals ready, `initDb` hangs, and the app is stuck on the
 * splash. It works in dev because Vite serves the nested worker live/unminified.
 *
 * Until `/bundle` boots in the prod bundle, force the proven single-tab direct
 * connection (the pre-BAH-139 path). Flip back to `true` to re-enable multi-tab
 * once the worker init is fixed and verified in a production build.
 */
const ENABLE_SHARED_DB = false;

/** Whether to use the shared-DB worker path (feature-flagged + browser-gated). */
const useSharedDb = () => ENABLE_SHARED_DB && isSharedDbSupported();

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
export const buildDrizzleDb = (getDb: () => Database | null) =>
  drizzle(
    async (sql, params, method) => {
      const db = getDb();
      if (!db) return { rows: [] };

      const stmt = db.prepare(sql);

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
    throw new Error(`Database initialization failed: ${result.error.type}`);
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

  if (useSharedDb()) {
    // The worker owns the OPFS files and (unlike the fallback) keeps sync
    // metadata in IndexedDB, not this context's localStorage. It can't be
    // deleted from here — the worker holds the OPFS handles — so delegate.
    const client = await getDbWorkerClient();
    await client.deleteLocal(LOCAL_DB_PATH_PREFIX);
    return;
  }

  // Fallback (direct in-tab connection): OPFS files and localStorage sync
  // metadata live in this context.
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
export const initDb = async () => {
  if (db) return ok(null);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = _initDbInternal();
  const result = await dbInitPromise;
  if (!result.ok) {
    dbInitPromise = null; // Allow retry on failure
    Sentry.logger.warn("initDb failed", { outcome: result.error.type });
  }
  return result;
};

const isApiError = (
  err: unknown
): err is NonNullable<
  Awaited<ReturnType<typeof api.databases.user.get>>
>["error"] => {
  return (
    typeof err === "object" && err !== null && "status" in err && "value" in err
  );
};

/**
 * When the DB is shared across tabs, serialize init across them with a Web Lock
 * so two tabs opening at once don't race on applying migrations (the connect
 * and pull/push are already idempotent / single-flighted in the worker). Within
 * a tab, the `dbInitPromise` singleton in `initDb` still dedupes. Falls through
 * to an unlocked init when Web Locks or SharedWorker aren't available.
 */
const _initDbInternal = async () => {
  if (isSharedDbSupported()) {
    return navigator.locks.request("bahar-db-init", () => _initDbUnlocked());
  }
  return _initDbUnlocked();
};

const _initDbUnlocked = async () => {
  const infoResult = await tryCatch(
    async () => {
      const { data, error } = await api.databases.user.get();
      if (error) throw error;
      return data;
    },
    (error) => {
      if (isApiError(error) && error?.status === 401) {
        return {
          type: "unauthorized",
          reason: String(error),
        };
      }

      return {
        type: "get_db_info_failed",
        reason: String(error),
      };
    }
  );
  if (!infoResult.ok) return infoResult;

  const { access_token, hostname, db_name } = infoResult.value;

  const connectionResult = await tryCatch(
    () =>
      _connectToLocalDb({
        hostname,
        authToken: access_token,
        dbName: db_name,
      }),
    (error) => {
      const reason = String(error);
      const isOpfsLock = reason.includes("createSyncAccessHandle");
      return {
        type: isOpfsLock ? "opfs_lock_error" : "db_connection_failed",
        reason,
      };
    }
  );

  // If OPFS lock error, return immediately - don't try token refresh
  if (
    !connectionResult.ok &&
    connectionResult.error.type === "opfs_lock_error"
  ) {
    return connectionResult;
  }

  if (!connectionResult.ok) return connectionResult;

  db = connectionResult.value;

  drizzleDb = buildDrizzleDb(() => db);

  const dbPullResult = await tryCatch(
    async () => {
      await db!.pull();
    },
    (error) => ({
      type: "turso_remote_sync_failed",
      reason: String(error),
    })
  );

  const migrationResult = await applyRequiredMigrations();
  if (!migrationResult.ok) return migrationResult;

  const syncResult = await tryCatch(
    async () => {
      await db!.pull();
      await db!.push();
    },
    (error) => ({
      type: "turso_remote_sync_failed",
      reason: String(error),
    })
  );

  const aggregateResult = (() => {
    if (!dbPullResult.ok && !syncResult.ok) {
      return err({
        type: "turso_remote_sync_and_pull_failed",
        reason: `Pull error: ${dbPullResult.error.reason}\nSync error: ${syncResult.error.reason}`,
      });
    }

    if (!dbPullResult.ok) {
      return err({
        type: "turso_db_pull_failed",
        reason: dbPullResult.error.reason,
      });
    }

    if (!syncResult.ok) {
      return err({
        type: "turso_remote_sync_failed",
        reason: syncResult.error.reason,
      });
    }

    return ok(null);
  })();

  return aggregateResult;
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
      reason: String(error),
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

  for (const migration of requiredMigrations) {
    const nowTimestampMs = Date.now();

    const execResult = await tryCatch(
      () => db!.exec(migration.sql_script),
      (error) => ({
        type: "migration_failed",
        reason: String(error),
      })
    );

    if (!execResult.ok) {
      await tryCatch(
        () =>
          db!
            .prepare(
              "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)"
            )
            .run([
              migration.version,
              migration.description,
              nowTimestampMs,
              "failed",
            ]),
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
        db!
          .prepare(
            "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)"
          )
          .run([
            migration.version,
            migration.description,
            nowTimestampMs,
            "applied",
          ]),
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
      const result = await db!
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';"
        )
        .get();
      return !!result;
    },
    () => ({ type: "check_migration_table_exists_query_failed" })
  );

  if (!tableExists.ok) return tableExists;
  if (!tableExists.value) return ok([] as SelectMigration[]);

  return tryCatch(
    async () => {
      const rows: SelectMigration[] = await db!
        .prepare("SELECT * FROM migrations;")
        .all();
      return rows;
    },
    () => ({ type: "local_migrations_query_failed" })
  );
};

const _formatDbUrl = (hostname: string) => `libsql://${hostname}`;

const _formatLocalDbName = (dbName: string) =>
  `${LOCAL_DB_PATH_PREFIX}-${dbName}.db`;

/**
 * Opens the local user DB. When SharedWorker is supported (every modern browser
 * incl. iOS 16.4+), ownership lives in a dedicated worker shared across all
 * tabs, and this returns a `Database`-shaped proxy over RPC — so a second tab no
 * longer fights over the browser-wide OPFS SyncAccessHandle. Older browsers
 * (iOS < 16.4) fall back to a direct in-tab connection: the previous
 * single-tab behavior, unchanged.
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
  const params = {
    path: _formatLocalDbName(dbName),
    url: _formatDbUrl(hostname),
    authToken,
  };

  if (useSharedDb()) {
    // Fall back to a direct in-tab connection if the shared worker can't come
    // up (e.g. it never signals ready). Without this, a hung worker leaves
    // initDb awaiting forever and the app stuck on the splash. The direct path
    // is the proven single-tab behavior; multi-tab OPFS contention degrades to
    // an opfs_lock_error the caller already handles.
    try {
      const client = await getDbWorkerClient();
      await client.connect(params);
      return client.dbProxy;
    } catch (error) {
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        { fingerprint: ["shared-db-worker-unavailable"] }
      );
      Sentry.logger.warn(
        "Shared DB worker unavailable; falling back to direct connection",
        { reason: String(error) }
      );
    }
  }

  return connect(params);
};
