import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import { insertDictionaryEntry, insertFlashcard } from "../test/factories";
import { makeDictionaryEntriesTable } from "./dictionary-entries";

describe("dictionaryEntriesTable", () => {
  let testDb: TestDb;
  let dictionaryEntriesTable: ReturnType<typeof makeDictionaryEntriesTable>;

  beforeEach(async () => {
    testDb = await createTestDb();
    dictionaryEntriesTable = makeDictionaryEntriesTable({
      getDb: async () => testDb.drizzleDb,
    });
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("entry", () => {
    it("returns the entry when it exists", async () => {
      const entry = await insertDictionaryEntry(testDb, {
        word: "كتاب",
        translation: "book",
      });

      const result = await dictionaryEntriesTable.entry.query(entry.id);

      expect(result).toMatchObject({
        id: entry.id,
        word: "كتاب",
        translation: "book",
      });
    });

    it("throws when the entry does not exist", async () => {
      await expect(
        dictionaryEntriesTable.entry.query("not-a-real-id")
      ).rejects.toThrow("Dictionary entry not found");
    });
  });

  describe("tags", () => {
    it("returns tag counts across all entries", async () => {
      await insertDictionaryEntry(testDb, { tags: ["foo", "bar"] });
      await insertDictionaryEntry(testDb, { tags: ["foo"] });
      await insertDictionaryEntry(testDb, { tags: ["baz"] });

      const results = await dictionaryEntriesTable.tags.query();

      expect(results.find((r) => r.tag === "foo")?.count).toBe(2);
      expect(results.find((r) => r.tag === "bar")?.count).toBe(1);
      expect(results.find((r) => r.tag === "baz")?.count).toBe(1);
    });

    it("filters tags by a search term", async () => {
      await insertDictionaryEntry(testDb, { tags: ["food"] });
      await insertDictionaryEntry(testDb, { tags: ["bar"] });

      const results = await dictionaryEntriesTable.tags.query("foo");

      expect(results.map((r) => r.tag)).toEqual(["food"]);
    });
  });

  describe("addWord", () => {
    it("inserts a new dictionary entry and returns it", async () => {
      const newEntry = await dictionaryEntriesTable.addWord.mutation({
        word: {
          word: "كتاب",
          translation: "book",
          type: "ism",
          tags: ["foo"],
        },
      });

      expect(newEntry).toMatchObject({
        id: expect.any(String),
        word: "كتاب",
        translation: "book",
        type: "ism",
        tags: ["foo"],
      });
    });

    it("stores unset optional JSON fields as SQL NULL, not the string 'null'", async () => {
      const newEntry = await dictionaryEntriesTable.addWord.mutation({
        word: { word: "كتاب", translation: "book", type: "ism" },
      });

      expect(newEntry.root).toBeNull();
      expect(newEntry.tags).toBeNull();
      expect(newEntry.antonyms).toBeNull();
      expect(newEntry.examples).toBeNull();
      expect(newEntry.morphology).toBeNull();

      const row = (await (
        await testDb.db.prepare("SELECT * FROM dictionary_entries WHERE id = ?")
      ).get([newEntry.id])) as Record<string, unknown>;

      expect(row.root).toBeNull();
      expect(row.tags).toBeNull();
    });
  });

  describe("editWord", () => {
    it("updates only the provided fields, leaving others untouched", async () => {
      const entry = await insertDictionaryEntry(testDb, {
        word: "كتاب",
        translation: "book",
        type: "ism",
        tags: ["foo"],
      });

      const updatedEntry = await dictionaryEntriesTable.editWord.mutation({
        id: entry.id,
        updates: { word: "قلم" },
      });

      expect(updatedEntry).toMatchObject({
        id: entry.id,
        word: "قلم",
        translation: "book",
        type: "ism",
        tags: ["foo"],
      });
      expect(updatedEntry.updated_at_timestamp_ms).toBeGreaterThanOrEqual(
        entry.updated_at_timestamp_ms ?? 0
      );
    });

    it("updates every other field", async () => {
      const entry = await insertDictionaryEntry(testDb);

      const updates = {
        translation: "pen",
        definition: "a writing instrument",
        type: "ism",
        root: ["ق", "ل", "م"],
        tags: ["bar"],
        antonyms: [{ word: "قلم" }],
        examples: [{ sentence: "هذا قلم." }],
        morphology: { ism: { singular: "قلم" } },
      } satisfies Partial<
        Omit<
          SelectDictionaryEntry,
          | "id"
          | "created_at"
          | "created_at_timestamp_ms"
          | "updated_at"
          | "updated_at_timestamp_ms"
        >
      >;

      const updatedEntry = await dictionaryEntriesTable.editWord.mutation({
        id: entry.id,
        updates,
      });

      expect(updatedEntry).toMatchObject(updates);
    });

    it("does not throw when no fields are provided, and only bumps updated_at", async () => {
      // Unlike the other tables' update ops, editWord has no "No fields to
      // update" guard -- it always pushes updated_at, so the set is never
      // empty. Pinning down the real (inconsistent-with-siblings) behavior.
      const entry = await insertDictionaryEntry(testDb, {
        word: "كتاب",
        translation: "book",
      });

      const updatedEntry = await dictionaryEntriesTable.editWord.mutation({
        id: entry.id,
        updates: {},
      });

      expect(updatedEntry).toMatchObject({ word: "كتاب", translation: "book" });
      expect(updatedEntry.updated_at_timestamp_ms).toBeGreaterThanOrEqual(
        entry.updated_at_timestamp_ms ?? 0
      );
    });

    it("throws when the entry does not exist", async () => {
      await expect(
        dictionaryEntriesTable.editWord.mutation({
          id: "not-a-real-id",
          updates: { word: "قلم" },
        })
      ).rejects.toThrow("Dictionary entry not found");
    });
  });

  describe("delete", () => {
    it("removes the entry and returns its pre-delete value", async () => {
      const entry = await insertDictionaryEntry(testDb, {
        word: "كتاب",
        translation: "book",
      });

      await expect(
        dictionaryEntriesTable.delete.mutation({ id: entry.id })
      ).resolves.toMatchObject({
        id: entry.id,
        word: "كتاب",
        translation: "book",
      });

      const exists = await (
        await testDb.db.prepare("SELECT * FROM dictionary_entries WHERE id = ?")
      ).get([entry.id]);

      expect(exists).toBeUndefined();
    });

    it("also deletes flashcards linked to the entry", async () => {
      // sync-wasm has no ON DELETE CASCADE, so delete does this manually --
      // pin it down so the shared impl keeps it.
      const entry = await insertDictionaryEntry(testDb);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
      });

      await dictionaryEntriesTable.delete.mutation({ id: entry.id });

      const flashcardExists = await (
        await testDb.db.prepare("SELECT * FROM flashcards WHERE id = ?")
      ).get([flashcard.id]);

      expect(flashcardExists).toBeUndefined();
    });

    it("throws when the entry does not exist", async () => {
      await expect(
        dictionaryEntriesTable.delete.mutation({ id: "not-a-real-id" })
      ).rejects.toThrow("Dictionary entry not found");
    });
  });

  describe("maxUpdatedAt", () => {
    it("returns the most recent updated_at_timestamp_ms across all entries", async () => {
      await insertDictionaryEntry(testDb, { updated_at_timestamp_ms: 1000 });
      await insertDictionaryEntry(testDb, { updated_at_timestamp_ms: 2000 });

      expect(await dictionaryEntriesTable.maxUpdatedAt.query()).toBe(2000);
    });

    it("returns null when there are no entries", async () => {
      expect(await dictionaryEntriesTable.maxUpdatedAt.query()).toBeNull();
    });
  });
});
