import { migrations } from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import { makeMigrationTable } from "./migration";

describe("migrationTable", () => {
  let testDb: TestDb;
  let migrationTable: ReturnType<typeof makeMigrationTable>;

  beforeEach(async () => {
    testDb = await createTestDb();
    migrationTable = makeMigrationTable({
      getDb: async () => testDb.drizzleDb,
    });
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("returns the highest-version migration", async () => {
    await testDb.drizzleDb.insert(migrations).values([
      { version: 1, description: "first", applied_at_ms: 1000 },
      { version: 3, description: "third", applied_at_ms: 3000 },
      { version: 2, description: "second", applied_at_ms: 2000 },
    ]);

    const result = await migrationTable.latestMigration.query();

    expect(result).toMatchObject({ version: 3, description: "third" });
  });
});
