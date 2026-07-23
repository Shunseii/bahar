/**
 * Database adapter backed by @tursodatabase/sync-react-native.
 *
 * Mobile runs the same Turso engine as web (sync-wasm) rather than the older
 * expo-sqlite/libSQL integration, so both platforms share one engine, one
 * sync protocol, and the same behavior the shared @bahar/db-operations test
 * harness verifies.
 *
 * Two surfaces are exposed:
 * - getDrizzleDb(): a drizzle instance (via the sqlite-proxy adapter in
 *   ./turso-sync-adapter) used by the shared operations. There's no first-party
 *   drizzle driver for sync-react-native (its Database doesn't extend
 *   @tursodatabase/database-common's DatabasePromise), so the proxy is the
 *   supported path -- see BAH-155.
 * - the DatabaseAdapter interface (prepare/exec/run/push/pull/close) used by
 *   migrations (../index) and sync bookkeeping (./sync) that need raw SQL.
 */

import type { DatabaseAdapter, PreparedStatement } from "@bahar/db-operations";
import {
  type BindParams,
  type Database,
  connect as tursoConnect,
} from "@tursodatabase/sync-react-native";
import { buildDrizzleDb } from "./turso-sync-adapter";

export const isSyncError = (error: unknown): boolean =>
  String(error).includes("sync error");

let dbInstance: Database | null = null;

type DrizzleDb = ReturnType<typeof buildDrizzleDb>;
let drizzleDb: DrizzleDb | null = null;

export const getDrizzleDb = (): DrizzleDb => {
  if (!drizzleDb) {
    throw new Error("Database not initialized. Call connect() first.");
  }
  return drizzleDb;
};

/**
 * Wraps a sync-react-native Database as the DatabaseAdapter interface for the
 * raw-SQL callers (migrations, sync bookkeeping).
 */
const createAdapter = (db: Database): DatabaseAdapter => {
  dbInstance = db;

  return {
    prepare<T = unknown>(sql: string): PreparedStatement<T> {
      // Each method finalizes its single-use statement to release the native
      // handle. run/all/get already reset the statement and release the exec
      // lock, but don't finalize -- so without this the per-call statements
      // would leak over a session.
      return {
        async all(params: unknown[] = []): Promise<T[]> {
          const stmt = db.prepare(sql);
          try {
            return (await stmt.all(params as BindParams)) as T[];
          } finally {
            await stmt.finalize();
          }
        },
        async get(params: unknown[] = []): Promise<T | undefined> {
          const stmt = db.prepare(sql);
          try {
            return (await stmt.get(params as BindParams)) as T | undefined;
          } finally {
            await stmt.finalize();
          }
        },
        async run(params: unknown[] = []): Promise<void> {
          const stmt = db.prepare(sql);
          try {
            await stmt.run(params as BindParams);
          } finally {
            await stmt.finalize();
          }
        },
      };
    },

    async exec(sql: string): Promise<void> {
      await db.exec(sql);
    },

    async push(): Promise<void> {
      await db.push();
    },

    async pull(): Promise<void> {
      await db.pull();
    },

    async close(): Promise<void> {
      drizzleDb = null;
      dbInstance = null;
      db.close();
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
 * Opens a local database that syncs with a remote Turso database.
 */
export const connect = async (
  options: ConnectOptions
): Promise<DatabaseAdapter> => {
  const db = await tursoConnect({
    path: options.name,
    url: options.url,
    authToken: options.authToken,
  });

  drizzleDb = buildDrizzleDb(() => dbInstance);

  return createAdapter(db);
};

/**
 * Manually triggers a sync with the remote database: pull remote changes, then
 * push local ones. Call periodically or after local changes.
 */
export const syncDatabase = async (): Promise<void> => {
  if (dbInstance) {
    await dbInstance.pull();
    await dbInstance.push();
  }
};

export type { DatabaseAdapter, PreparedStatement } from "@bahar/db-operations";
