/**
 * Database management for mobile app.
 *
 * Handles initialization, connection, and synchronization
 * with the user's Turso database.
 */

import {
  type DbConnectionInfo,
  type DbError,
  runDbInit,
} from "@bahar/db-core";
import { err, ok, type Result, tryCatch } from "@bahar/result";
import * as Sentry from "@sentry/react-native";
import { getDbPath } from "@tursodatabase/sync-react-native";
import { reloadAppAsync } from "expo";
import { File } from "expo-file-system";
import { api } from "../../utils/api";
import {
  connect,
  type DatabaseAdapter,
  isSyncError,
} from "./adapter";

const LOCAL_DB_NAME = "bahar-user.db";
export const SYNC_INTERVAL_MS = 60_000;

/**
 * Singleton database instance.
 */
let db: DatabaseAdapter | null = null;
let dbInitPromise: Promise<Result<null, DbError>> | null = null;
let currentDbName: string | null = null;

/**
 * Serializes an arbitrary thrown value into a Sentry-friendly shape. `String(error)`
 * alone collapses wasm/Turso errors to opaque one-liners (e.g. "RuntimeError:
 * unreachable") and drops the stack; this preserves name/stack/cause so the
 * underlying failure -- including native sync-react-native frames -- is
 * diagnosable once it reaches Sentry via the init capture in useAppInit.
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
 * Best-effort check of whether the local replica file already exists, to
 * distinguish a first-run create from a reconnect in init logs. Returns null if
 * the path can't be resolved.
 */
const replicaExists = (dbFileName: string): boolean | null => {
  try {
    const basePath = getDbPath(dbFileName);
    const uri = basePath.startsWith("file://")
      ? basePath
      : `file://${basePath}`;
    return new File(uri).exists;
  } catch {
    return null;
  }
};

/**
 * Gets the initialized database instance.
 * Throws if not initialized.
 */
export const getDb = (): DatabaseAdapter => {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
};

/**
 * Ensures the database is initialized before returning it.
 */
export const ensureDb = async (): Promise<DatabaseAdapter> => {
  const result = await initDb();
  if (!result.ok) {
    throw new Error(`Database initialization failed: ${result.error.type}`);
  }
  return getDb();
};

/**
 * Closes the database connection and clears references.
 * Used on normal logout — the local file is kept for fast re-login.
 */
export const resetDb = async (): Promise<void> => {
  if (db) {
    try {
      await db.close();
    } catch (error) {
      console.warn("[db] closeAsync failed:", error);
    }
    db = null;
    dbInitPromise = null;
  }
};

/**
 * Deletes the local replica files. The remote Turso database is not affected.
 * Requires an app restart afterwards because the native engine's state can
 * only be fully reset by restarting the process.
 *
 * sync-react-native stores the replica in its own writable directory (iOS
 * Documents / Android database dir), resolved via getDbPath -- not the
 * expo-sqlite `Documents/SQLite` location -- writing the db file plus sidecar
 * files (-wal, -shm, -info).
 */
export const deleteLocalDb = (): void => {
  if (!currentDbName) return;
  const basePath = getDbPath(currentDbName);
  for (const suffix of ["", "-wal", "-shm", "-info"]) {
    const path = `${basePath}${suffix}`;
    const uri = path.startsWith("file://") ? path : `file://${path}`;
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  }
  currentDbName = null;
};

/**
 * Recovers from an unresolvable sync conflict by deleting the local
 * replica and restarting the app. On restart, openDatabaseAsync
 * will pull a fresh copy from the remote.
 *
 * BAHAR-MOBILE-2: never wipe when offline. The wipe+reload recovery
 * re-inits via connect+pull -- all network operations -- so wiping
 * offline destroys the only copy of the user's data and leaves the
 * app unable to start. Offline, degrade instead: keep the conflicted
 * but locally-intact replica; the next online sync re-runs recovery.
 */
export const recoverFromSyncConflict = async (): Promise<void> => {
  const offline = isDeviceOffline();

  if (offline) {
    console.warn("[db] Sync conflict while offline — keeping local replica");
    Sentry.logger.warn(
      "recoverFromSyncConflict: offline — deferring wipe, keeping local replica",
      { dbName: currentDbName }
    );
    return;
  }

  console.warn("[db] Sync conflict — deleting local DB and restarting...");
  // Destructive: wipes the local replica and restarts. Log before the wipe so
  // there's a record even though the reload tears down the JS context -- this
  // path was previously silent (console-only).
  Sentry.logger.warn("recoverFromSyncConflict: deleting local replica", {
    dbName: currentDbName,
  });
  deleteLocalDb();
  await reloadAppAsync("Resolving sync conflict");
};

/**
 * Whether the device currently has no network connection. Best-effort
 * via RN's navigator.onLine (updated on reachability change events);
 * a false "online" just means the wipe+reload proceeds as before, and
 * a true "offline" blocks the destructive wipe (BAHAR-MOBILE-2).
 */
const isDeviceOffline = (): boolean =>
  typeof navigator !== "undefined" && !navigator.onLine;

/**
 * Initializes the database connection.
 *
 * Uses a promise-based singleton pattern to prevent race conditions
 * if called concurrently before initialization completes.
 */
export const initDb = async (): Promise<Result<null, DbError>> => {
  if (db) return ok(null);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = _initDbInternal();
  const result = await dbInitPromise;
  if (!result.ok) {
    dbInitPromise = null; // Allow retry on failure
    Sentry.logger.warn("initDb failed", {
      outcome: result.error.type,
      reason: result.error.reason,
    });
  }
  return result;
};

const _initDbInternal = async (): Promise<Result<null, DbError>> => {
  Sentry.logger.info("initDb: start");

  const platform = {
    getConnectionInfo: async (): Promise<DbConnectionInfo> => {
      const { data, error } = await api.databases.user.get();
      if (error) throw error;
      return data;
    },
    connect: async (info: DbConnectionInfo) => {
      const dbFileName = `${LOCAL_DB_NAME}-${info.db_name}.db`;
      const connectOptions = {
        name: dbFileName,
        url: `libsql://${info.hostname}`,
        authToken: info.access_token,
      };

      const dbAlreadyExists = replicaExists(dbFileName);
      Sentry.logger.info("initDb: fetched db info", {
        dbName: info.db_name,
        hostname: info.hostname,
        dbAlreadyExists,
      });

      const connected = await connect(connectOptions);
      db = connected;
      currentDbName = dbFileName;

      Sentry.logger.info("initDb: connected to local db");
    },
    pull: async () => {
      await db!.pull!();
    },
    push: async () => {
      await db!.push!();
    },
    isSyncError: (error: unknown) => isSyncError(error),
    isOffline: () => isDeviceOffline(),
  };

  // Mobile's applyRequiredMigrations returns errors directly; map
  // the migrations-API-fetch failure to api_schema_verification_failed
  // so runDbInit's degradation policy applies (same as web).
  const originalApplyMigrations = applyRequiredMigrations;
  const migrationsWithMappedError = async (): Promise<
    Result<unknown, DbError>
  > => {
    const result = await originalApplyMigrations();
    if (!result.ok && result.error.type === "get_migrations_failed") {
      return {
        ok: false as const,
        error: { ...result.error, type: "api_schema_verification_failed" },
      };
    }
    return result;
  };

  const outcome = await runDbInit(platform, {
    applyRequiredMigrations: migrationsWithMappedError,
  });

  if (outcome.outcome === "degraded") {
    Sentry.logger.warn("initDb: degraded -- using stale local replica", {
      outcome: outcome.error.type,
      reason: outcome.error.reason,
    });
    return ok(null);
  }

  if (outcome.outcome === "err") {
    return err(outcome.error);
  }

  Sentry.logger.info("initDb: success");
  return ok(null);
};

/**
 * Applies required migrations to the user database.
 */
const applyRequiredMigrations = async (): Promise<Result<null, DbError>> => {
  if (!db) return ok(null);

  const migrationsResult = await tryCatch(
    async () => {
      const { data, error } = await api.migrations.full.get();
      if (error) throw error;
      return data;
    },
    (error) => ({
      type: "get_migrations_failed",
      ...describeError(error),
    })
  );

  if (!migrationsResult.ok) return migrationsResult;

  const allMigrations = migrationsResult.value;
  if (!allMigrations.length) return ok(null);

  const localMigrationsResult = await getLocalAppliedMigrations();
  if (!localMigrationsResult.ok) return localMigrationsResult;

  const appliedVersions = new Set(
    localMigrationsResult.value
      .filter((m) => m.status === "applied")
      .map((m) => m.version)
  );

  // Apply new migrations
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

    // Passed whole rather than split on ";". sync-react-native's exec loops
    // prepareFirst internally, so it handles multi-statement scripts, and
    // letting SQLite find the boundaries means a semicolon inside a comment or
    // a string literal cannot corrupt a statement. Matches the web applier.
    const execResult = await tryCatch(
      () => db!.exec(migration.sql_script),
      (error) => ({
        type: "migration_failed",
        migrationVersion: migration.version,
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
          Sentry.logger.error("initDb: failed to record failed migration", {
            version: migration.version,
            reason: String(error),
          });
          return null;
        }
      );
      return execResult;
    }

    // Record successful migration
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
        Sentry.logger.error("initDb: failed to record applied migration", {
          version: migration.version,
          reason: String(error),
        });
        return null;
      }
    );
  }

  return ok(null);
};

interface LocalMigration {
  version: number;
  description: string;
  applied_at_ms: number;
  status: "applied" | "pending" | "failed";
}

const getLocalAppliedMigrations = async (): Promise<
  Result<LocalMigration[], DbError>
> => {
  if (!db) return err({ type: "db_not_initialized", reason: "" });

  // Check if migrations table exists
  const tableExists = await tryCatch(
    async () => {
      const result = await db!
        .prepare<{
          name: string;
        }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';"
        )
        .get();
      return !!result;
    },
    (error) => ({
      type: "check_migration_table_failed",
      ...describeError(error),
    })
  );

  if (!tableExists.ok) return tableExists as Result<never, DbError>;
  if (!tableExists.value) return ok([]);

  return tryCatch(
    async () => {
      const rows = await db!
        .prepare<LocalMigration>("SELECT * FROM migrations;")
        .all();
      return rows;
    },
    (error) => ({
      type: "get_local_migrations_failed",
      ...describeError(error),
    })
  );
};
