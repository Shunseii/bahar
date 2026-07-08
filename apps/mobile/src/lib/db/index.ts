/**
 * Database management for mobile app.
 *
 * Handles initialization, connection, and synchronization
 * with the user's Turso database.
 */

import { err, ok, type Result, tryCatch } from "@bahar/result";
import { getDbPath } from "@tursodatabase/sync-react-native";
import { reloadAppAsync } from "expo";
import { File } from "expo-file-system/next";
import { api } from "../../utils/api";
import {
  connect,
  type DatabaseAdapter,
  isSyncError,
  syncDatabase,
} from "./adapter";

const LOCAL_DB_NAME = "bahar-user.db";
export const SYNC_INTERVAL_MS = 60_000;

/**
 * Singleton database instance.
 */
let db: DatabaseAdapter | null = null;
let dbInitPromise: Promise<Result<null, DbError>> | null = null;
let currentDbName: string | null = null;

type DbError = {
  type: string;
  reason: string;
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
 */
export const recoverFromSyncConflict = async (): Promise<void> => {
  console.warn("[db] Sync conflict — deleting local DB and restarting...");
  deleteLocalDb();
  await reloadAppAsync("Resolving sync conflict");
};

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
  if (!result.ok) dbInitPromise = null; // Allow retry on failure
  return result;
};

const _initDbInternal = async (): Promise<Result<null, DbError>> => {
  // Get database connection info from API
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

  const dbFileName = `${LOCAL_DB_NAME}-${db_name}.db`;
  const connectOptions = {
    name: dbFileName,
    url: `libsql://${hostname}`,
    authToken: access_token,
  };

  // Connect to local database with remote sync
  const connectionResult = await tryCatch(
    () => connect(connectOptions),
    (error) => ({
      type: "db_connection_failed",
      reason: String(error),
    })
  );

  if (!connectionResult.ok) return connectionResult;

  db = connectionResult.value;
  currentDbName = dbFileName;

  // Pull from remote before migrations — local migration writes
  // create frames that conflict with the remote's existing frames.
  const pullResult = await tryCatch(
    () => syncDatabase(),
    (error) => ({
      type: "initial_pull_failed" as const,
      reason: String(error),
    })
  );

  if (!pullResult.ok && isSyncError(pullResult.error.reason)) {
    await recoverFromSyncConflict();
    return pullResult;
  }

  // Apply any required migrations (split by statement since libSQL's
  // execAsync only executes the first statement in multi-statement SQL)
  const migrationResult = await applyRequiredMigrations();
  if (!migrationResult.ok) return migrationResult;

  // Sync after migrations to push any new migration records
  const syncResult = await tryCatch(
    async () => {
      await syncDatabase();
      return null;
    },
    (error) => ({
      type: "post_migration_sync_failed",
      reason: String(error),
    })
  );

  if (!syncResult.ok && isSyncError(syncResult.error.reason)) {
    await recoverFromSyncConflict();
  }

  return syncResult;
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
      reason: String(error),
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

  for (const migration of requiredMigrations) {
    const nowTimestampMs = Date.now();

    // libSQL's execAsync only executes the first statement in a
    // multi-statement string, so split and run each individually.
    const statements = migration.sql_script
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    const execResult = await tryCatch(
      async () => {
        for (const statement of statements) {
          await db!.exec(`${statement};`);
        }
      },
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
        () => null
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
      () => null
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
    () => ({ type: "check_migration_table_failed", reason: "" })
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
    () => ({ type: "get_local_migrations_failed", reason: "" })
  );
};
