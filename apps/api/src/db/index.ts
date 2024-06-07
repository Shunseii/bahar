import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { users } from "./schema/users.js";
import { sessions } from "./schema/sessions.js";
import { DrizzleSQLiteAdapter } from "@lucia-auth/adapter-drizzle";

export const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_TOKEN!,
});

export const db = drizzle(client, { schema: { users, sessions } });
export const adapter = new DrizzleSQLiteAdapter(db, sessions, users);
