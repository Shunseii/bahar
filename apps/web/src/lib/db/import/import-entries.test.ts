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
 * Wraps a real database so every write touching one entry fails, standing in for
 * any runtime error part-way through a batch: a constraint violation, a closed
 * connection, a disk problem.
 *
 * Targeting an entry rather than the nth statement keeps these tests readable
 * and stable -- how many statements an entry costs is an implementation detail
 * that has changed before.
 */
const failOnEntry = (db: TestDb["db"], entryId: string) => ({
  run: (sql: string, args: unknown[]) =>
    args.includes(entryId)
      ? Promise.reject(new Error(`write failed for ${entryId}`))
      : db.run(sql, args),
  transaction: db.transaction.bind(db),
});

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
    expect(await countEntries(testDb.db)).toBe(0);

    // No progress at all rather than 0 of 0: callers divide current by total to
    // render a percentage, and the settings page showed NaN% for an empty file.
    expect(progress).toEqual([]);
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

  /**
   * Each batch is its own transaction, so a failure part-way through a large
   * file leaves the import partial: batches before it stand, the failing batch
   * writes nothing, and the ones after it never run. Re-running the same file
   * upserts over whatever landed.
   */
  describe("when a write fails part-way through", () => {
    it("writes nothing from the batch the failure was in", async () => {
      // The 3rd entry fails, so its two predecessors are already written when
      // the transaction unwinds.
      const db = failOnEntry(testDb.db, "entry-2");

      await expect(
        importEntries({
          db,
          entries: makeEntries(4),
          version: 1,
          createReverseByDefault: false,
          batchSize: 4,
        })
      ).rejects.toThrow("write failed for entry-2");

      expect(await countEntries(testDb.db)).toBe(0);
      expect(await countCards(testDb.db)).toBe(0);
    });

    it("keeps the entries from batches that finished first", async () => {
      // Batches of two put the failing entry in the second batch, with the
      // first already committed.
      const db = failOnEntry(testDb.db, "entry-2");

      await expect(
        importEntries({
          db,
          entries: makeEntries(6),
          version: 1,
          createReverseByDefault: false,
          batchSize: 2,
        })
      ).rejects.toThrow("write failed for entry-2");

      expect(await countEntries(testDb.db)).toBe(2);
    });

    it("never runs the batches queued behind the failure", async () => {
      // Ten entries in batches of two is five batches. The failure is in the
      // second, so three more are queued and none of them may write.
      const db = failOnEntry(testDb.db, "entry-2");

      await expect(
        importEntries({
          db,
          entries: makeEntries(10),
          version: 1,
          createReverseByDefault: false,
          batchSize: 2,
        })
      ).rejects.toThrow("write failed for entry-2");

      expect(await countEntries(testDb.db)).toBe(2);
    });
  });
});
