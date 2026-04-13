/**
 * Expo-SQLite database adapter with libSQL/Turso sync support.
 *
 * Implements the DatabaseAdapter interface from @bahar/db-operations
 * for cross-platform database operations using expo-sqlite.
 */

import type { DatabaseAdapter, PreparedStatement } from "@bahar/db-operations";
import * as schema from "@bahar/drizzle-user-db-schemas";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";

export const isSyncError = (error: unknown): boolean =>
  String(error).includes("sync error");

// Store the database instance for sync operations
let dbInstance: SQLite.SQLiteDatabase | null = null;

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
let drizzleDb: DrizzleDb | null = null;

export const getDrizzleDb = (): DrizzleDb => {
  if (!drizzleDb) {
    throw new Error("Database not initialized. Call connect() first.");
  }
  return drizzleDb;
};

/**
 * Wraps an expo-sqlite database to implement the DatabaseAdapter interface.
 */
const createAdapter = (db: SQLite.SQLiteDatabase): DatabaseAdapter => {
  // Store reference for sync operations
  dbInstance = db;

  return {
    prepare<T = unknown>(sql: string): PreparedStatement<T> {
      return {
        async all(params: unknown[] = []): Promise<T[]> {
          const result = await db.getAllAsync<T>(
            sql,
            params as SQLite.SQLiteBindParams
          );
          return result;
        },
        async get(params: unknown[] = []): Promise<T | undefined> {
          const result = await db.getFirstAsync<T>(
            sql,
            params as SQLite.SQLiteBindParams
          );
          return result ?? undefined;
        },
        async run(params: unknown[] = []): Promise<void> {
          await db.runAsync(sql, params as SQLite.SQLiteBindParams);
        },
      };
    },

    async exec(sql: string): Promise<void> {
      await db.execAsync(sql);
    },

    async push(): Promise<void> {
      await db.syncLibSQL();
    },

    async pull(): Promise<void> {
      await db.syncLibSQL();
    },

    async close(): Promise<void> {
      drizzleDb = null;
      dbInstance = null;
      await db.closeAsync();
    },
  };
};

export interface ConnectOptions {
  /** Local database file name */
  name: string;
  /** Remote Turso database URL */
  url: string;
  /** Authentication token for Turso */
  authToken: string;
}

/**
 * Opens a local SQLite database that syncs with a remote Turso database.
 */
export const connect = async (
  options: ConnectOptions
): Promise<DatabaseAdapter> => {
  const db = await SQLite.openDatabaseAsync(options.name, {
    finalizeUnusedStatementsBeforeClosing: false,
    libSQLOptions: {
      url: options.url,
      authToken: options.authToken,
      remoteOnly: false,
    },
  });

  drizzleDb = drizzle(db, { schema });

  return createAdapter(db);
};

/**
 * Manually triggers a sync with the remote database.
 * Call this periodically or after local changes.
 */
export const syncDatabase = async (): Promise<void> => {
  if (dbInstance) {
    await dbInstance.syncLibSQL();
  }
};

export type { DatabaseAdapter, PreparedStatement } from "@bahar/db-operations";
