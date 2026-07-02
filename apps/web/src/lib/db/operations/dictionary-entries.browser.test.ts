import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import { insertDictionaryEntry, insertFlashcard } from "../test/factories";

const dbRef = vi.hoisted(() => ({ current: undefined as TestDb | undefined }));

vi.mock("..", async (importOriginal) => ({
  ...(await importOriginal()),
  ensureDb: vi.fn(async () => dbRef.current?.db),
  getDb: vi.fn(() => dbRef.current?.db),
  getDrizzleDb: vi.fn(() => dbRef.current?.drizzleDb),
}));

const { dictionaryEntriesTable } = await import("./dictionary-entries");

describe("dictionaryEntriesTable", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbRef.current = testDb;
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
      const entryResult = dictionaryEntriesTable.entry.query("not-a-real-id");

      await expect(entryResult).rejects.toThrow("Dictionary entry not found");
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

      const entryExists = await testDb.db
        .prepare("SELECT * FROM dictionary_entries WHERE id = ?")
        .get([newEntry.id]);

      expect(entryExists).toBeDefined();
    });

    it("stores unset optional JSON fields as SQL NULL, not the string 'null'", async () => {
      const newEntry = await dictionaryEntriesTable.addWord.mutation({
        word: {
          word: "كتاب",
          translation: "book",
          type: "ism",
        },
      });

      expect(newEntry.root).toBeNull();
      expect(newEntry.tags).toBeNull();
      expect(newEntry.antonyms).toBeNull();
      expect(newEntry.examples).toBeNull();
      expect(newEntry.morphology).toBeNull();

      const row = await testDb.db
        .prepare("SELECT * FROM dictionary_entries WHERE id = ?")
        .get([newEntry.id]);

      expect(row.root).toBeNull();
      expect(row.tags).toBeNull();
      expect(row.antonyms).toBeNull();
      expect(row.examples).toBeNull();
      expect(row.morphology).toBeNull();
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

      const updatedWord = "قلم";

      const updatedEntry = await dictionaryEntriesTable.editWord.mutation({
        id: entry.id,
        updates: { word: updatedWord },
      });

      expect(updatedEntry).toMatchObject({
        id: entry.id,
        word: updatedWord,
        translation: "book",
        type: "ism",
        tags: ["foo"],
      });
      expect(updatedEntry.updated_at_timestamp_ms).toBeGreaterThanOrEqual(
        entry.updated_at_timestamp_ms ?? 0
      );

      const entryExists = await testDb.db
        .prepare("SELECT * FROM dictionary_entries WHERE id = ?")
        .get([entry.id]);

      expect(entryExists.word).toBe(updatedWord);
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

      const row = await testDb.db
        .prepare("SELECT * FROM dictionary_entries WHERE id = ?")
        .get([entry.id]);

      expect(row.translation).toBe(updates.translation);
      expect(row.definition).toBe(updates.definition);
      expect(row.type).toBe(updates.type);
      expect(JSON.parse(row.root)).toEqual(updates.root);
      expect(JSON.parse(row.tags)).toEqual(updates.tags);
      expect(JSON.parse(row.antonyms)).toEqual(updates.antonyms);
      expect(JSON.parse(row.examples)).toEqual(updates.examples);
      expect(JSON.parse(row.morphology)).toEqual(updates.morphology);
    });

    it("does not throw when no fields are provided, and only bumps updated_at", async () => {
      // Unlike decksTable.update/flashcardsTable.update/settingsTable.update,
      // editWord has no "No fields to update" guard -- it always pushes
      // updated_at/updated_at_timestamp_ms onto setClauses unconditionally,
      // so that array is never actually empty. Pinning down the real
      // (inconsistent-with-its-siblings) behavior rather than the assumed one.
      const entry = await insertDictionaryEntry(testDb, {
        word: "كتاب",
        translation: "book",
      });

      const updatedEntry = await dictionaryEntriesTable.editWord.mutation({
        id: entry.id,
        updates: {},
      });

      expect(updatedEntry).toMatchObject({
        word: "كتاب",
        translation: "book",
      });
      expect(updatedEntry.updated_at_timestamp_ms).toBeGreaterThanOrEqual(
        entry.updated_at_timestamp_ms ?? 0
      );
    });

    it("throws when the entry does not exist", async () => {
      const editResult = dictionaryEntriesTable.editWord.mutation({
        id: "not-a-real-id",
        updates: { word: "قلم" },
      });

      await expect(editResult).rejects.toThrow("Dictionary entry not found");
    });
  });

  describe("delete", () => {
    it("removes the entry and returns its pre-delete value", async () => {
      const entry = await insertDictionaryEntry(testDb, {
        word: "كتاب",
        translation: "book",
      });

      const deleteResult = dictionaryEntriesTable.delete.mutation({
        id: entry.id,
      });

      await expect(deleteResult).resolves.toMatchObject({
        id: entry.id,
        word: "كتاب",
        translation: "book",
      });

      const entryExists = await testDb.db
        .prepare("SELECT * FROM dictionary_entries WHERE id = ?")
        .get([entry.id]);

      expect(entryExists).toBeUndefined();
    });

    it("also deletes flashcards linked to the entry", async () => {
      // sync-wasm doesn't support ON DELETE CASCADE, so dictionaryEntriesTable.delete
      // does this manually -- pin it down so the drizzle refactor doesn't drop it.
      const entry = await insertDictionaryEntry(testDb);
      const flashcard = await insertFlashcard(testDb, {
        dictionary_entry_id: entry.id,
      });

      await dictionaryEntriesTable.delete.mutation({ id: entry.id });

      const flashcardExists = await testDb.db
        .prepare("SELECT * FROM flashcards WHERE id = ?")
        .get([flashcard.id]);

      expect(flashcardExists).toBeUndefined();
    });

    it("throws when the entry does not exist", async () => {
      // Differs from decksTable.delete, which does NOT throw for a missing id --
      // pinning this down since the two tables currently behave differently
      // for the same kind of operation.
      const deleteResult = dictionaryEntriesTable.delete.mutation({
        id: "not-a-real-id",
      });

      await expect(deleteResult).rejects.toThrow("Dictionary entry not found");
    });
  });

  describe("maxUpdatedAt", () => {
    it("returns the most recent updated_at_timestamp_ms across all entries", async () => {
      await insertDictionaryEntry(testDb, { updated_at_timestamp_ms: 1000 });
      await insertDictionaryEntry(testDb, { updated_at_timestamp_ms: 2000 });

      const result = await dictionaryEntriesTable.maxUpdatedAt.query();

      expect(result).toBe(2000);
    });

    it("returns null when there are no entries", async () => {
      const result = await dictionaryEntriesTable.maxUpdatedAt.query();

      expect(result).toBeNull();
    });
  });
});
