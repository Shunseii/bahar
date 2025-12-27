/**
 * Expo-SQLite database adapter with libSQL/Turso sync support.
 *
 * Implements the DatabaseAdapter interface from @bahar/db-operations
 * for cross-platform database operations using expo-sqlite.
 */

import type { DatabaseAdapter, PreparedStatement } from "@bahar/db-operations";
import * as SQLite from "expo-sqlite";

// Store the database instance for sync operations
let dbInstance: SQLite.SQLiteDatabase | null = null;

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
      // libsql sync is bidirectional - syncLibSQL handles both push and pull
      try {
        console.log("[adapter] Starting push/sync...");
        await db.syncLibSQL();
        console.log("[adapter] Push/sync completed");
      } catch (error) {
        console.error("[adapter] Push/sync failed:", error);
        throw error;
      }
    },

    async pull(): Promise<void> {
      // libsql sync is bidirectional - syncLibSQL handles both push and pull
      try {
        console.log("[adapter] Starting pull/sync...");
        await db.syncLibSQL();
        console.log("[adapter] Pull/sync completed");
      } catch (error) {
        console.error("[adapter] Pull/sync failed:", error);
        throw error;
      }
    },

    async close(): Promise<void> {
      await db.closeAsync();
      dbInstance = null;
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
  /** Sync interval in seconds (default: 60) - not used directly, sync is manual */
  syncInterval?: number;
}

/**
 * Opens a local SQLite database that syncs with a remote Turso database.
 */
export const connect = async (
  options: ConnectOptions
): Promise<DatabaseAdapter> => {
  const db = await SQLite.openDatabaseAsync(options.name, {
    libSQLOptions: {
      url: options.url,
      authToken: options.authToken,
      remoteOnly: false,
    },
  });

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

export type { DatabaseAdapter, PreparedStatement };
