import { connect, type Database } from "@tursodatabase/sync-wasm/vite";
import { buildDrizzleDb } from "..";

/**
 * Migration SQL inlined as static string data via Vite's glob import
 * (rather than `node:fs`) so this harness can run inside the real
 * browser context that `@tursodatabase/sync-wasm` requires for tests.
 */
const migrationModules = import.meta.glob(
  "../../../../../../packages/drizzle-user-db-schemas/drizzle/*.sql",
  { eager: true, query: "?raw", import: "default" }
) as Record<string, string>;

const applyMigrations = async (db: Database) => {
  const migrationFiles = Object.keys(migrationModules).sort();

  for (const file of migrationFiles) {
    await db.exec(migrationModules[file]);
  }
};

export type TestDb = {
  db: Database;
  drizzleDb: ReturnType<typeof buildDrizzleDb>;
  close: () => Promise<void>;
};

/**
 * Spins up a local, in-memory sync-wasm database (no remote url, so no
 * network/OPFS involvement) with the real migrations applied, for tests
 * that need actual SQLite semantics rather than mocks.
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
