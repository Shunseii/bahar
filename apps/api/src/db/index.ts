import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { users, sessions } from "./schema/auth";
import { config } from "../utils/config";

export const client = createClient({
  url: config.DATABASE_URL,
  authToken: config.TURSO_TOKEN,
});

export const db = drizzle(client, { schema: { users, sessions } });
