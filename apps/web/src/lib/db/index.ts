import type { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import { err, ok, tryCatch } from "@bahar/result";
import * as Sentry from "@sentry/react";
import { connect, type Database } from "@tursodatabase/sync-wasm/vite";
import { api } from "../api";

/**
 * Singleton database instance connected to
 * a local copy of the user's database that syncs
 * with the remote database in turso.
 *
 * Initially undefined, but we initialize it
 * in the pre load of the root router.
 */
let db: Database | null = null;
let dbInitPromise: ReturnType<typeof _initDbInternal> | null = null;

const LOCAL_DB_PATH_PREFIX = "bahar-local";

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

export const resetDb = async () => {
  if (!db) return;

  await db.close();
  db = null;
  dbInitPromise = null;
};

/**
 * Deletes all local OPFS databases and Turso sync metadata from localStorage.
 * Use this to recover from corrupted sync state or schema conflicts.
 *
 * Note: It's important to clear both opfs and localStorage otherwise
 * the data will be in a worse state.
 */
export const deleteLocalDatabase = async () => {
  if (db) {
    await db.close();
    db = null;
    dbInitPromise = null;
  }

  // Delete all OPFS files starting with our prefix
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
  if (!result.ok) dbInitPromise = null; // Allow retry on failure
  return result;
};

const _initDbInternal = async () => {
  const infoResult = await tryCatch(
    async () => {
      const { data, error } = await api.databases.user.get();
      if (error) throw error;
      return data;
    },
    (error) => ({
      type: "get_db_info_failed",
      reason: String(error),
    })
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

  if (connectionResult.ok) {
    db = connectionResult.value;
  } else {
    const refreshResult = await tryCatch(
      async () => {
        const { data, error } = await api.databases["refresh-token"].post();
        if (error) throw error;
        return data;
      },
      (error) => ({
        type: "token_refresh_failed",
        reason: String(error),
      })
    );
    if (!refreshResult.ok) return refreshResult;

    const connectionAfterRefreshResult = await tryCatch(
      () =>
        _connectToLocalDb({
          hostname,
          authToken: refreshResult.value.access_token,
          dbName: db_name,
        }),
      (error) => {
        const reason = String(error);
        const isOpfsLock = reason.includes("createSyncAccessHandle");
        return {
          type: isOpfsLock
            ? "opfs_lock_error"
            : "db_connection_failed_after_refresh",
          reason,
        };
      }
    );

    if (!connectionAfterRefreshResult.ok) return connectionAfterRefreshResult;

    db = connectionAfterRefreshResult.value;
  }

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

    if (!dbPullResult.ok)
      return err({
        type: "turso_db_pull_failed",
        reason: dbPullResult.error.reason,
      });

    if (!syncResult.ok)
      return err({
        type: "turso_remote_sync_failed",
        reason: syncResult.error.reason,
      });

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

const _connectToLocalDb = ({
  hostname,
  authToken,
  dbName,
}: {
  hostname: string;
  authToken: string;
  dbName: string;
}) => {
  return connect({
    path: _formatLocalDbName(dbName),
    url: _formatDbUrl(hostname),
    authToken,
  });
};
