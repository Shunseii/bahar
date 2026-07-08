import * as schema from "@bahar/drizzle-user-db-schemas";
import { type Client, createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import { API_URL } from "./config";
import { readJsonResponse } from "./http";

export type UserDb = ReturnType<typeof drizzle<typeof schema>>;

type UserDatabaseInfo = {
  hostname: string;
  access_token: string;
};

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

  return { db: drizzle(client, { schema }), client };
};
