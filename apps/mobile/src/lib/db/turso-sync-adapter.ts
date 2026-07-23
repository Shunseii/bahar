/**
 * Builds the drizzle sqlite-proxy adapter around a `@tursodatabase/sync-react-native`
 * `Database`. Mirrors apps/web/src/lib/db/index.ts's buildDrizzleDb -- there's no
 * first-party drizzle driver for this package either, so this translates drizzle's
 * generic query calls into the db's own prepare/run/all/get API.
 *
 * Rows come back name-keyed, matched to the query's compiled column names --
 * drizzle doesn't emit SQL aliases to guarantee those names are unique across a
 * join. Any query selecting plain columns from both sides of a join into the same
 * output (e.g. both flashcards.id and dictionaryEntries.id, both literally "id")
 * must alias the colliding one explicitly via `sql<T>`column`.as("uniqueName")`,
 * or the duplicate name silently collapses and misaligns every value after it.
 * Same requirement as web -- see that file's comment for the full explanation.
 *
 * Typed against a minimal structural interface rather than importing
 * @tursodatabase/sync-react-native's `Database` class directly, so this can be
 * unit-tested with a plain fake object -- the real Database is a native JSI
 * binding and, like expo-sqlite's native module, can't run under jest-expo.
 */
import * as schema from "@bahar/drizzle-user-db-schemas";
import type {
  BindParams,
  Row,
  RunResult,
} from "@tursodatabase/sync-react-native";
import { drizzle } from "drizzle-orm/sqlite-proxy";

export interface SyncAdapterStatement {
  run(...params: BindParams[]): Promise<RunResult>;
  all(...params: BindParams[]): Promise<Row[]>;
  get(...params: BindParams[]): Promise<Row | undefined>;
  finalize(): Promise<void>;
}

export interface SyncAdapterDb {
  prepare(sql: string): SyncAdapterStatement;
}

export const buildDrizzleDb = (getDb: () => SyncAdapterDb | null) =>
  drizzle(
    async (sql, params, method) => {
      const db = getDb();
      if (!db) return { rows: [] };

      // A fresh statement is prepared per call, so it MUST be finalized after
      // use. sync-react-native holds native resources on a prepared statement
      // until finalize(); for a write (UPDATE/INSERT) that includes SQLite's
      // write lock, so an un-finalized write blocks every later read until the
      // connection is torn down (app restart). Finalize in a finally so it
      // happens even if the query throws.
      const stmt = db.prepare(sql);
      try {
        if (method === "run") {
          await stmt.run(params as BindParams);
          return { rows: [] };
        }

        if (method === "all" || method === "values") {
          const rows = await stmt.all(params as BindParams);
          return { rows: rows.map((row) => Object.values(row)) };
        }

        if (method === "get") {
          const row = await stmt.get(params as BindParams);
          return { rows: row ? Object.values(row) : [] };
        }

        return { rows: [] };
      } finally {
        await stmt.finalize();
      }
    },
    { schema }
  );
