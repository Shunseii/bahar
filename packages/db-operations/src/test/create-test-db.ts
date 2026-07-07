import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, type Database } from "@tursodatabase/sync";
import { buildDrizzleDb } from "./build-drizzle-db";

/**
 * Absolute path to the generated drizzle migration SQL, resolved relative to
 * this file so it works regardless of the cwd vitest runs from.
 */
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle-user-db-schemas/drizzle"
);

const applyMigrations = async (db: Database) => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
};

export type TestDb = {
  db: Database;
  drizzleDb: ReturnType<typeof buildDrizzleDb>;
  close: () => Promise<void>;
};

/**
 * Spins up a local, in-memory `@tursodatabase/sync` database (no remote url,
 * so no network) with the real migrations applied, for tests that need
 * actual SQLite semantics rather than mocks. Runs in plain Node -- unlike
 * sync-wasm (browser only) and sync-react-native (native device only), this
 * binding loads directly, so shared operations can be tested here once and
 * trusted on both platforms.
 */
export const createTestDb = async (): Promise<TestDb> => {
  const db = await connect({ path: ":memory:" });

  await applyMigrations(db);

  return {
    db,
    drizzleDb: buildDrizzleDb(() => db),
    close: () => db.close(),
  };
};
