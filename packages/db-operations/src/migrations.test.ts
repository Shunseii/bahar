import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@tursodatabase/sync";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../drizzle-user-db-schemas/drizzle"
);

const BREAKPOINT_MARKER = "--> statement-breakpoint";

/**
 * Migrations do not reach a client as files. They are registered as rows in the
 * central `migrations` table and handed to clients as a single `sql_script`
 * string, which each applier then has to execute.
 *
 * These tests apply the real files the way that pipeline does, because the
 * `createTestDb` helpers execute a file whole and so cannot catch a script that
 * only breaks once it has been through registration and an applier.
 */

/**
 * Mirrors the registration transform in
 * `apps/api/scripts/register-schema-migrations.ts`. Duplicated rather than
 * imported because a package cannot depend on an app -- keep the two in step.
 */
const toRegistryScript = (rawSql: string) =>
  rawSql.split(BREAKPOINT_MARKER).join("\n");

/**
 * Mirrors `applyAllNewMigrations` in `apps/api/src/clients/turso.ts`, which has
 * to hand `batch()` an array of single statements so it can append the
 * `INSERT INTO migrations` row in the same batch.
 */
const splitForBatch = (sqlScript: string) =>
  sqlScript
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

type Migration = { description: string; sqlScript: string };

let migrations: Migration[] = [];

beforeAll(() => {
  migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      description: file.replace(/\.sql$/, ""),
      sqlScript: toRegistryScript(
        readFileSync(join(MIGRATIONS_DIR, file), "utf8")
      ),
    }));
});

describe("per-user database migrations", () => {
  it("finds the migration files", () => {
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0].description).toMatch(/^0000_/);
  });

  it("applies as one script per migration, the way web and mobile do", async () => {
    const db = await connect({ path: ":memory:" });

    try {
      for (const migration of migrations) {
        await expect(
          db.exec(migration.sqlScript),
          `${migration.description} failed to apply as a whole script`
        ).resolves.not.toThrow();
      }
    } finally {
      await db.close();
    }
  });

  /**
   * The api applier splits on ";", which assumes no statement, comment or
   * string literal contains one. A semicolon inside a comment is the easy way
   * to break that: the split cuts the comment in half and the tail, no longer
   * preceded by "--", gets parsed as SQL.
   *
   * That is why these files carry no prose. Rationale for a migration belongs in
   * its commit message, not in the script that gets registered and split.
   */
  it("applies as split statements, the way the api does", async () => {
    const db = await connect({ path: ":memory:" });

    try {
      for (const migration of migrations) {
        for (const [index, statement] of splitForBatch(
          migration.sqlScript
        ).entries()) {
          await expect(
            db.exec(statement),
            `${migration.description} statement ${index} failed after splitting on ";": ${statement.slice(0, 80)}`
          ).resolves.not.toThrow();
        }
      }
    } finally {
      await db.close();
    }
  });

  it("keeps the scripts free of semicolons inside comments", () => {
    // Guards the assumption above at the source, so a new migration fails here
    // with a clear reason rather than as a syntax error in a split fragment.
    for (const migration of migrations) {
      const offending = migration.sqlScript
        .split("\n")
        .filter((line) => line.trim().startsWith("--") && line.includes(";"));

      expect(
        offending,
        `${migration.description} has a comment containing ";", which the api applier's split would break apart`
      ).toEqual([]);
    }
  });

  it("leaves the schema the operations expect", async () => {
    const db = await connect({ path: ":memory:" });

    try {
      for (const migration of migrations) {
        await db.exec(migration.sqlScript);
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
