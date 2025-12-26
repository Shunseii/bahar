/**
 * Database management for mobile app.
 *
 * Handles initialization, connection, and synchronization
 * with the user's Turso database.
 */

import { ok, err, tryCatch, type Result } from "@bahar/result";
import { connect, type DatabaseAdapter, syncDatabase } from "./adapter";
import { api } from "../../utils/api";

const LOCAL_DB_NAME = "bahar-user.db";
export const SYNC_INTERVAL_MS = 60_000;

/**
 * Singleton database instance.
 */
let db: DatabaseAdapter | null = null;
let dbInitPromise: Promise<Result<null, DbError>> | null = null;

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
 * Closes and resets the database connection.
 */
export const resetDb = async (): Promise<void> => {
  if (db) {
    await db.close();
    db = null;
    dbInitPromise = null;
  }
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
    }),
  );

  if (!infoResult.ok) return infoResult;

  const { access_token, hostname, db_name } = infoResult.value;

  // Connect to local database with remote sync
  const connectionResult = await tryCatch(
    () =>
      connect({
        name: `${LOCAL_DB_NAME}-${db_name}.db`,
        url: `libsql://${hostname}`,
        authToken: access_token,
        syncInterval: 60, // Sync every 60 seconds
      }),
    (error) => ({
      type: "db_connection_failed",
      reason: String(error),
    }),
  );

  if (!connectionResult.ok) {
    // Try refreshing token and reconnecting
    const refreshResult = await tryCatch(
      async () => {
        const { data, error } = await api.databases["refresh-token"].post();
        if (error) throw error;
        return data;
      },
      (error) => ({
        type: "token_refresh_failed",
        reason: String(error),
      }),
    );

    if (!refreshResult.ok) return refreshResult;

    const retryResult = await tryCatch(
      () =>
        connect({
          name: `${LOCAL_DB_NAME}-${db_name}.db`,
          url: `libsql://${hostname}`,
          authToken: refreshResult.value.access_token,
          syncInterval: 60,
        }),
      (error) => ({
        type: "db_connection_failed_after_refresh",
        reason: String(error),
      }),
    );

    if (!retryResult.ok) return retryResult;
    db = retryResult.value;
  } else {
    db = connectionResult.value;
  }

  // Apply any required migrations
  const migrationResult = await applyRequiredMigrations();
  if (!migrationResult.ok) return migrationResult;

  // Initial sync to pull remote data
  console.log("[db] Starting initial sync...");
  const syncStartTime = Date.now();
  const syncResult = await tryCatch(
    async () => {
      await db!.pull?.();
      const syncDuration = Date.now() - syncStartTime;
      console.log(`[db] Initial sync completed in ${syncDuration}ms`);

      // Check how many rows we have after sync
      const countResult = await db!.prepare<{ count: number }>(
        "SELECT COUNT(*) as count FROM dictionary_entries"
      ).get();
      console.log(`[db] Dictionary entries count: ${countResult?.count ?? 0}`);

      const decksCount = await db!.prepare<{ count: number }>(
        "SELECT COUNT(*) as count FROM decks"
      ).get();
      console.log(`[db] Decks count: ${decksCount?.count ?? 0}`);

      const flashcardsCount = await db!.prepare<{ count: number }>(
        "SELECT COUNT(*) as count FROM flashcards"
      ).get();
      console.log(`[db] Flashcards count: ${flashcardsCount?.count ?? 0}`);

      return null;
    },
    (error) => ({
      type: "initial_sync_failed",
      reason: String(error),
    }),
  );

  return syncResult;
};

/**
 * Applies required migrations to the user database.
 */
const applyRequiredMigrations = async (): Promise<Result<null, DbError>> => {
  if (!db) return ok(null);

  // Get migrations from API
  const migrationsResult = await tryCatch(
    async () => {
      const { data, error } = await api.migrations.full.get();
      if (error) throw error;
      return data;
    },
    (error) => ({
      type: "get_migrations_failed",
      reason: String(error),
    }),
  );

  if (!migrationsResult.ok) return migrationsResult;

  const allMigrations = migrationsResult.value;
  if (!allMigrations.length) return ok(null);

  // Check which migrations are already applied
  const localMigrationsResult = await getLocalAppliedMigrations();
  if (!localMigrationsResult.ok) return localMigrationsResult;

  const appliedVersions = new Set(
    localMigrationsResult.value
      .filter((m) => m.status === "applied")
      .map((m) => m.version),
  );

  // Apply new migrations
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
      }),
    );

    if (!execResult.ok) {
      // Record failed migration
      await tryCatch(
        () =>
          db!
            .prepare(
              "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
            )
            .run([
              migration.version,
              migration.description,
              nowTimestampMs,
              "failed",
            ]),
        () => null,
      );
      return execResult;
    }

    // Record successful migration
    await tryCatch(
      () =>
        db!
          .prepare(
            "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
          )
          .run([
            migration.version,
            migration.description,
            nowTimestampMs,
            "applied",
          ]),
      () => null,
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
        .prepare<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';",
        )
        .get();
      return !!result;
    },
    () => ({ type: "check_migration_table_failed", reason: "" }),
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
    () => ({ type: "get_local_migrations_failed", reason: "" }),
  );
};
