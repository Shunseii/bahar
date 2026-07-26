import {
  createTestDb,
  type TestDb,
} from "@bahar/db-operations/src/test/create-test-db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportEntries } from "./export-entries";

const DUE_AT = "2025-12-01T04:26:40.315Z";

const seedEntry = async (
  db: TestDb["db"],
  {
    id,
    word = "كتاب",
    tags = JSON.stringify(["معهد الخليل"]),
  }: { id: string; word?: string; tags?: string | null }
) => {
  await db.run(
    `INSERT INTO dictionary_entries (id, word, translation, type, tags)
     VALUES (?, ?, ?, ?, ?)`,
    [id, word, "book", "ism", tags]
  );
};

const seedCard = async (
  db: TestDb["db"],
  {
    id,
    entryId,
    direction,
    reps,
  }: {
    id: string;
    entryId: string;
    direction: "forward" | "reverse";
    reps: number;
  }
) => {
  await db.run(
    `INSERT INTO flashcards
       (id, dictionary_entry_id, due, due_timestamp_ms, reps, state, direction, is_hidden)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, entryId, DUE_AT, Date.parse(DUE_AT), reps, 2, direction, 0]
  );
};

describe("exportEntries", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("exports an empty dictionary as no entries", async () => {
    const result = await exportEntries({
      db: testDb.db,
      includeFlashcards: true,
    });

    expect(result).toEqual({ entries: [], skipped: [] });
  });

  it("exports every entry in the dictionary", async () => {
    await seedEntry(testDb.db, { id: "e1", word: "كتاب" });
    await seedEntry(testDb.db, { id: "e2", word: "قلم" });

    const { entries, skipped } = await exportEntries({
      db: testDb.db,
      includeFlashcards: false,
    });

    expect(skipped).toEqual([]);
    expect(entries.map((entry) => entry.id).sort()).toEqual(["e1", "e2"]);
    expect(entries[0]).toMatchObject({ type: "ism", tags: ["معهد الخليل"] });
  });

  it("assigns each card to its direction's key regardless of row order", async () => {
    await seedEntry(testDb.db, { id: "e1" });
    // Inserted reverse-first so a row-position assumption would show up here.
    await seedCard(testDb.db, {
      id: "c-rev",
      entryId: "e1",
      direction: "reverse",
      reps: 3,
    });
    await seedCard(testDb.db, {
      id: "c-fwd",
      entryId: "e1",
      direction: "forward",
      reps: 9,
    });

    const { entries } = await exportEntries({
      db: testDb.db,
      includeFlashcards: true,
    });

    expect(entries[0].flashcard?.reps).toBe(9);
    expect(entries[0].flashcard_reverse?.reps).toBe(3);
  });

  it("keeps each entry's cards with that entry", async () => {
    await seedEntry(testDb.db, { id: "e1" });
    await seedEntry(testDb.db, { id: "e2" });
    await seedCard(testDb.db, {
      id: "c1",
      entryId: "e1",
      direction: "forward",
      reps: 9,
    });
    await seedCard(testDb.db, {
      id: "c2",
      entryId: "e2",
      direction: "forward",
      reps: 4,
    });

    const { entries } = await exportEntries({
      db: testDb.db,
      includeFlashcards: true,
    });

    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    expect(byId.get("e1")?.flashcard?.reps).toBe(9);
    expect(byId.get("e2")?.flashcard?.reps).toBe(4);
  });

  it("omits cards entirely when flashcards are excluded", async () => {
    await seedEntry(testDb.db, { id: "e1" });
    await seedCard(testDb.db, {
      id: "c1",
      entryId: "e1",
      direction: "forward",
      reps: 9,
    });

    const { entries } = await exportEntries({
      db: testDb.db,
      includeFlashcards: false,
    });

    expect("flashcard" in entries[0]).toBe(false);
    expect("flashcard_reverse" in entries[0]).toBe(false);
    expect("created_at" in entries[0]).toBe(false);
  });

  describe("when an entry's stored json is corrupt", () => {
    it("skips it and reports which entry and field", async () => {
      await seedEntry(testDb.db, { id: "e-bad", tags: "{not json" });

      const { entries, skipped } = await exportEntries({
        db: testDb.db,
        includeFlashcards: true,
      });

      expect(entries).toEqual([]);
      expect(skipped).toHaveLength(1);
      expect(skipped[0]).toMatchObject({
        entryId: "e-bad",
        word: "كتاب",
        field: "tags",
      });
    });

    it("still exports the entries around it", async () => {
      await seedEntry(testDb.db, { id: "e-ok-1", word: "قلم" });
      await seedEntry(testDb.db, { id: "e-bad", tags: "{not json" });
      await seedEntry(testDb.db, { id: "e-ok-2", word: "بيت" });

      const { entries, skipped } = await exportEntries({
        db: testDb.db,
        includeFlashcards: true,
      });

      // One bad row must not cost the user the rest of their dictionary.
      expect(entries.map((entry) => entry.id).sort()).toEqual([
        "e-ok-1",
        "e-ok-2",
      ]);
      expect(skipped.map((entry) => entry.entryId)).toEqual(["e-bad"]);
    });
  });
});
