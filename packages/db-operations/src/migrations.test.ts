import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@tursodatabase/sync";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../drizzle-user-db-schemas/drizzle"
);

type Migration = { description: string; sql: string };

let migrations: Migration[] = [];

beforeAll(() => {
  migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      description: file.replace(/\.sql$/, ""),
      sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
    }));
});

describe("per-user database migrations", () => {
  it("finds the migration files", () => {
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0].description).toMatch(/^0000_/);
  });

  it("applies every migration in order to a fresh database", async () => {
    const db = await connect({ path: ":memory:" });

    try {
      for (const migration of migrations) {
        await expect(
          db.exec(migration.sql),
          `${migration.description} failed to apply`
        ).resolves.not.toThrow();
      }
    } finally {
      await db.close();
    }
  });

  it("leaves the schema the operations expect", async () => {
    const db = await connect({ path: ":memory:" });

    try {
      for (const migration of migrations) {
        await db.exec(migration.sql);
      }

      const tables = (await db.all(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      )) as { name: string }[];

      expect(tables.map((table) => table.name)).toEqual(
        expect.arrayContaining([
          "decks",
          "dictionary_entries",
          "flashcards",
          "migrations",
          "settings",
          "user_stats",
        ])
      );

      const indexes = (await db.all(
        "SELECT name FROM sqlite_master WHERE type = 'index'"
      )) as { name: string }[];

      // The import upsert resolves against this one, so a rename would turn
      // ON CONFLICT into a silent duplicate-row bug.
      expect(indexes.map((index) => index.name)).toContain(
        "flashcards_entry_direction_unique"
      );
    } finally {
      await db.close();
    }
  });
});
