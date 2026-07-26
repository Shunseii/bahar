import {
  createTestDb,
  type TestDb,
} from "@bahar/db-operations/src/test/create-test-db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ImportProgress, importEntries } from "./import-entries";
import type { ImportWordV1 } from "./v1/schema";

const makeEntries = (count: number): ImportWordV1[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `entry-${index}`,
    word: `كلمة-${index}`,
    translation: `word ${index}`,
    type: "ism" as const,
  }));

const countEntries = async (db: TestDb["db"]) => {
  const rows: { id: string }[] = await db.all(
    "SELECT id FROM dictionary_entries"
  );

  return rows.length;
};

const countCards = async (db: TestDb["db"]) => {
  const rows: { id: string }[] = await db.all("SELECT id FROM flashcards");

  return rows.length;
};

/**
 * Wraps a real database so the nth statement fails, standing in for any runtime
 * error part-way through a batch -- a constraint violation, a closed connection,
 * a disk problem.
 */
const failOnNthStatement = (db: TestDb["db"], n: number) => {
  let calls = 0;

  return {
    run: (sql: string, args: unknown[]) => {
      calls += 1;

      if (calls === n) {
        return Promise.reject(new Error("statement failed"));
      }

      return db.run(sql, args);
    },
    transaction: db.transaction.bind(db),
  };
};

describe("importEntries", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("writes every entry with its forward card", async () => {
    const result = await importEntries({
      db: testDb.db,
      entries: makeEntries(3),
      version: 1,
      createReverseByDefault: false,
    });

    expect(result).toEqual({ entryCount: 3, batchCount: 1 });
    expect(await countEntries(testDb.db)).toBe(3);
    expect(await countCards(testDb.db)).toBe(3);
  });

  it("splits the work into batches of the requested size", async () => {
    const result = await importEntries({
      db: testDb.db,
      entries: makeEntries(250),
      version: 1,
      createReverseByDefault: false,
      batchSize: 100,
    });

    expect(result).toEqual({ entryCount: 250, batchCount: 3 });
    expect(await countEntries(testDb.db)).toBe(250);
  });

  it("defaults to batches of 100", async () => {
    const result = await importEntries({
      db: testDb.db,
      entries: makeEntries(150),
      version: 1,
      createReverseByDefault: false,
    });

    expect(result.batchCount).toBe(2);
  });

  it("reports progress once up front and once per completed batch", async () => {
    const progress: ImportProgress[] = [];

    await importEntries({
      db: testDb.db,
      entries: makeEntries(250),
      version: 1,
      createReverseByDefault: false,
      batchSize: 100,
      onProgress: (update) => progress.push(update),
    });

    // The leading 0 lets the caller render a determinate bar before the first
    // batch lands, which on a large import is several seconds.
    expect(progress).toEqual([
      { current: 0, total: 3 },
      { current: 1, total: 3 },
      { current: 2, total: 3 },
      { current: 3, total: 3 },
    ]);
  });

  it("creates reverse cards for every entry when the account default is on", async () => {
    await importEntries({
      db: testDb.db,
      entries: makeEntries(4),
      version: 1,
      createReverseByDefault: true,
    });

    expect(await countCards(testDb.db)).toBe(8);
  });

  it("does nothing for an empty file", async () => {
    const progress: ImportProgress[] = [];

    const result = await importEntries({
      db: testDb.db,
      entries: [],
      version: 1,
      createReverseByDefault: false,
      onProgress: (update) => progress.push(update),
    });

    expect(result).toEqual({ entryCount: 0, batchCount: 0 });
    expect(progress).toEqual([{ current: 0, total: 0 }]);
    expect(await countEntries(testDb.db)).toBe(0);
  });

  it("rejects on an unsupported version before touching the database", async () => {
    await expect(
      importEntries({
        db: testDb.db,
        entries: makeEntries(2),
        version: 99,
        createReverseByDefault: false,
      })
    ).rejects.toThrow("Unsupported import version: 99");

    expect(await countEntries(testDb.db)).toBe(0);
  });

  describe("when a statement fails part-way through", () => {
    it("rolls back the batch it was in", async () => {
      // Each entry writes two statements, so the 5th lands inside the third
      // entry of the batch, after two have already been written.
      const db = failOnNthStatement(testDb.db, 5);

      await expect(
        importEntries({
          db,
          entries: makeEntries(4),
          version: 1,
          createReverseByDefault: false,
          batchSize: 4,
        })
      ).rejects.toThrow("statement failed");

      expect(await countEntries(testDb.db)).toBe(0);
      expect(await countCards(testDb.db)).toBe(0);
    });

    it("keeps the batches that already committed", async () => {
      // Batches of 2 means 4 statements per batch, so failing on the 5th puts
      // the error in the second batch with the first already committed.
      const db = failOnNthStatement(testDb.db, 5);

      await expect(
        importEntries({
          db,
          entries: makeEntries(6),
          version: 1,
          createReverseByDefault: false,
          batchSize: 2,
        })
      ).rejects.toThrow("statement failed");

      // Partial import is the accepted behaviour: committed batches stay, and
      // re-running the file upserts over them.
      expect(await countEntries(testDb.db)).toBe(2);
    });

    it("stops rather than carrying on to later batches", async () => {
      const db = failOnNthStatement(testDb.db, 5);

      await expect(
        importEntries({
          db,
          entries: makeEntries(10),
          version: 1,
          createReverseByDefault: false,
          batchSize: 2,
        })
      ).rejects.toThrow("statement failed");

      expect(await countEntries(testDb.db)).toBe(2);
    });
  });
});
