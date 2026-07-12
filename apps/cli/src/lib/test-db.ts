import * as schema from "@bahar/drizzle-user-db-schemas";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { UserDb } from "./db";

const MIGRATIONS_DIR = new URL(
  "../../../../packages/drizzle-user-db-schemas/drizzle/",
  import.meta.url
);

/**
 * Spins up an in-memory libsql database with the real per-user-db schema
 * applied, for tests that exercise the apply-* helpers against actual SQL
 * (constraints, FKs, JSON columns) rather than a mock. Mirrors the harness in
 * apply-grades.test.ts, but reads the migration files from the drizzle
 * directory so new migrations are picked up without editing a hardcoded list.
 */
export const buildTestDb = async (): Promise<{ db: UserDb; raw: Client }> => {
  const raw = createClient({ url: ":memory:" });

  const glob = new Bun.Glob("*.sql");
  const files = (
    await Array.fromAsync(glob.scan({ cwd: MIGRATIONS_DIR.pathname }))
  ).sort();

  for (const file of files) {
    const sql = await Bun.file(new URL(file, MIGRATIONS_DIR)).text();
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await raw.execute(statement);
    }
  }

  const db = drizzle(raw, { schema }) as unknown as UserDb;
  return { db, raw };
};
