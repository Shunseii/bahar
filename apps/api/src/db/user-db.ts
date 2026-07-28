import {
  makeDictionaryEntriesTable,
  makeFlashcardsTable,
} from "@bahar/db-operations";
import * as schema from "@bahar/drizzle-user-db-schemas";
import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { getUserDbClient } from "../clients/turso";

/**
 * Builds the drizzle sqlite-proxy adapter around a `@libsql/client` remote
 * `Client`. This is the API's twin of the per-platform adapters the apps ship:
 * web's buildDrizzleDb (sync-wasm), mobile's turso-sync-adapter
 * (sync-react-native), the CLI's (libsql), and the test harness's
 * (@tursodatabase/sync). All build a `drizzle-orm/sqlite-proxy` db, so the type
 * is identical to `@bahar/db-operations`'s `DrizzleDb` and the shared
 * operations run against it unchanged.
 *
 * Unlike the app adapters this one writes straight to the remote database
 * rather than to a local replica that syncs later, so a write here is visible
 * to other clients only after their next pull (~60s).
 *
 * libsql `Row`s come back with column names as enumerable properties and
 * positional indices as non-enumerable ones, so `Object.values(row)` yields the
 * column values in order -- the same name-keyed contract the other adapters map
 * from.
 */
export const buildUserDrizzleDb = (client: Client) =>
  drizzle(
    async (sql, params, method) => {
      const { rows } = await client.execute({ sql, args: params });

      if (method === "run") {
        return { rows: [] };
      }

      if (method === "get") {
        const row = rows[0];
        return { rows: row ? Object.values(row) : [] };
      }

      return { rows: rows.map((row) => Object.values(row)) };
    },
    async (queries) => {
      const results = await client.batch(
        queries.map((query) => ({ sql: query.sql, args: query.params }))
      );

      return results.map(({ rows }) => ({
        rows: rows.map((row) => Object.values(row)),
      }));
    },
    { schema }
  );

/**
 * Opens the user's personal database and returns the shared operations bound
 * to it, or null when the user has no database provisioned yet.
 *
 * The write queue is overridden with a pass-through. That queue exists to stop
 * concurrent writes tripping "database is busy" on a local SQLite file; here
 * writes go to a remote libsql database over HTTP, which has no such
 * constraint, and the queue's single lane is process-wide -- it would serialize
 * every user's request behind every other user's.
 *
 * The caller owns the returned `client` and should close it when the request
 * is done.
 */
export const getUserOperations = async (userId: string) => {
  const client = await getUserDbClient(userId);

  if (!client) {
    return null;
  }

  const drizzleDb = buildUserDrizzleDb(client);
  const deps = {
    getDb: async () => drizzleDb,
    enqueue: <T>(operation: () => Promise<T>) => operation(),
  };

  return {
    client,
    dictionaryEntriesTable: makeDictionaryEntriesTable(deps),
    flashcardsTable: makeFlashcardsTable(deps),
  };
};
