import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { config } from "../utils/config";
import { sessions, users } from "./schema/auth";

export const client = createClient({
  url: config.DATABASE_URL,
  authToken: config.TURSO_TOKEN,
});

export const db = drizzle(client, { schema: { users, sessions } });
