import * as schema from "@bahar/drizzle-user-db-schemas";
import type { Database } from "@tursodatabase/sync";
import { drizzle } from "drizzle-orm/sqlite-proxy";

/**
 * Builds the drizzle sqlite-proxy adapter around a `@tursodatabase/sync`
 * (Node) `Database`. This is the test-harness twin of the per-platform
 * adapters the apps ship: web's buildDrizzleDb (sync-wasm) and mobile's
 * turso-sync-adapter (sync-react-native). All three wrap the same Turso
 * engine family and share the same row-mapping contract, so operations
 * verified against this harness behave identically in both apps.
 *
 * Rows come back name-keyed, matched to the query's compiled column names.
 * drizzle doesn't emit SQL aliases to guarantee those names are unique
 * across a join, so any query selecting plain columns from both sides of a
 * join into the same output (e.g. both flashcards.id and
 * dictionaryEntries.id, both literally "id") must alias the colliding one
 * explicitly via `sql<T>`column`.as("uniqueName")`, or the duplicate name
 * silently collapses and misaligns every value after it. The same collapse
 * is reproduced here, so the harness catches a missing alias.
 *
 * Note: unlike sync-wasm/sync-react-native, this Node binding's `prepare()`
 * is async, so it's awaited below.
 */
const execute = async (
  db: Database,
  sql: string,
  params: unknown[],
  method: string
) => {
  const stmt = await db.prepare(sql);

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
};

export const buildDrizzleDb = (getDb: () => Database | null) =>
  drizzle(
    async (sql, params, method) => {
      const db = getDb();
      if (!db) return { rows: [] };

      return execute(db, sql, params, method);
    },
    // Routes drizzle's `.batch()` through the engine's own transaction, so a
    // multi-statement operation either lands whole or not at all. Statements
    // run in order; the engine rolls back if any of them throws.
    async (queries) => {
      const db = getDb();
      if (!db) return queries.map(() => ({ rows: [] }));

      const runBatch = db.transaction(async () => {
        const results: { rows: unknown[] }[] = [];

        for (const { sql, params, method } of queries) {
          results.push(await execute(db, sql, params, method));
        }

        return results;
      });

      return runBatch();
    },
    { schema }
  );
