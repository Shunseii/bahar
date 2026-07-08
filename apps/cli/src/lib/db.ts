import * as schema from "@bahar/drizzle-user-db-schemas";
import { type Client, createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { API_URL } from "./config";
import { readJsonResponse } from "./http";

export type UserDb = ReturnType<typeof drizzle<typeof schema>>;

type UserDatabaseInfo = {
  hostname: string;
  access_token: string;
};

/**
 * Builds the drizzle sqlite-proxy adapter around a `@libsql/client/web`
 * remote `Client`. This is the CLI's twin of the per-platform adapters the
 * apps ship: web's buildDrizzleDb (sync-wasm) and mobile's turso-sync-adapter
 * (sync-react-native), and the test harness's build-drizzle-db
 * (@tursodatabase/sync). All build a `drizzle-orm/sqlite-proxy` db, so the
 * type is identical to `@bahar/db-operations`'s `DrizzleDb` and shared
 * operations (e.g. progress/recordReview) run against it unchanged.
 *
 * libsql `Row`s come back with column names as enumerable properties and
 * positional indices as non-enumerable ones, so `Object.values(row)` yields
 * the column values in order -- the same name-keyed contract the other
 * adapters map from.
 *
 * The batch callback routes drizzle's `.batch()` to `client.batch()`, whose
 * default (deferred) mode wraps the statements in a transaction -- the same
 * atomicity `drizzle-orm/libsql/web`'s `db.batch()` provided.
 */
const buildDrizzleDb = (client: Client) =>
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
 * Opens a remote-only connection to the user's personal Turso database.
 *
 * Uses the fetch-based `@libsql/client/web` client so the CLI stays free of
 * native bindings and embeds cleanly in the compiled binary — no embedded
 * replica, no sync.
 */
export const connectUserDb = async (
  token: string
): Promise<{ db: UserDb; client: Client }> => {
  const response = await fetch(new URL("/databases/user", API_URL), {
    headers: { "x-api-key": token },
  });

  const info = await readJsonResponse<UserDatabaseInfo>({
    response,
    context: "Fetching database info",
  });

  const client = createClient({
    url: `libsql://${info.hostname}`,
    authToken: info.access_token,
  });

  return { db: buildDrizzleDb(client), client };
};
