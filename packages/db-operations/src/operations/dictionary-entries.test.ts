import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import {
  insertDictionaryEntry,
  insertFlashcard,
  insertSettings,
} from "../test/factories";
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

  describe("addWordWithFlashcards", () => {
    const readFlashcards = async (entryId: string) =>
      (await (
        await testDb.db.prepare(
          "SELECT * FROM flashcards WHERE dictionary_entry_id = ? ORDER BY direction"
        )
      ).all([entryId])) as Record<string, unknown>[];

    it("inserts the entry and a forward card in one call", async () => {
      const result =
        await dictionaryEntriesTable.addWordWithFlashcards.mutation({
          word: { word: "كتاب", translation: "book", type: "ism" },
        });

      expect(result.entry).toMatchObject({
        id: expect.any(String),
        word: "كتاب",
        translation: "book",
        type: "ism",
      });
      expect(result.forward).toMatchObject({
        dictionary_entry_id: result.entry.id,
        direction: "forward",
      });
      expect(result.reverse).toBeNull();

      const rows = await readFlashcards(result.entry.id);
      expect(rows).toHaveLength(1);
    });

    it("creates a reverse card when create_reverse_by_default is on", async () => {
      await insertSettings(testDb, { create_reverse_by_default: true });

      const result =
        await dictionaryEntriesTable.addWordWithFlashcards.mutation({
          word: { word: "كتاب", translation: "book", type: "ism" },
        });

      expect(result.reverse).toMatchObject({
        dictionary_entry_id: result.entry.id,
        direction: "reverse",
      });

      const rows = await readFlashcards(result.entry.id);
      expect(rows.map((r) => r.direction)).toEqual(["forward", "reverse"]);
    });

    it("lets an explicit createReverse override the setting in both directions", async () => {
      await insertSettings(testDb, { create_reverse_by_default: true });

      const optedOut =
        await dictionaryEntriesTable.addWordWithFlashcards.mutation({
          word: { word: "قلم", translation: "pen", type: "ism" },
          createReverse: false,
        });

      expect(optedOut.reverse).toBeNull();
      expect(await readFlashcards(optedOut.entry.id)).toHaveLength(1);

      // Flip the stored default the other way and opt back in. The column is
      // still named `show_reverse_flashcards` in SQL -- drizzle aliases it,
      // because renaming a synced column breaks Turso sync's push.
      await testDb.db.exec("UPDATE settings SET show_reverse_flashcards = 0");

      const optedIn =
        await dictionaryEntriesTable.addWordWithFlashcards.mutation({
          word: { word: "باب", translation: "door", type: "ism" },
          createReverse: true,
        });

      expect(optedIn.reverse).not.toBeNull();
      expect(await readFlashcards(optedIn.entry.id)).toHaveLength(2);
    });

    it("rolls the entry back when the flashcard insert fails", async () => {
      // The batch runs inside the engine's transaction, so a failure on the
      // second statement must undo the first. Without that, the entry would
      // survive with no cards and never surface for review -- the orphan state
      // this operation exists to prevent.
      await testDb.db.exec(`
        CREATE TRIGGER reject_flashcards BEFORE INSERT ON flashcards
        BEGIN SELECT RAISE(ABORT, 'flashcard insert rejected'); END;
      `);

      await expect(
        dictionaryEntriesTable.addWordWithFlashcards.mutation({
          word: { word: "كتاب", translation: "book", type: "ism" },
        })
      ).rejects.toThrow();

      const entries = (await (
        await testDb.db.prepare("SELECT * FROM dictionary_entries")
      ).all([])) as Record<string, unknown>[];

      expect(entries).toHaveLength(0);
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

  describe("entriesByIds", () => {
    it("returns a map of the requested ids", async () => {
      const a = await insertDictionaryEntry(testDb, { word: "أ" });
      const b = await insertDictionaryEntry(testDb, { word: "ب" });
      await insertDictionaryEntry(testDb); // not requested

      const map = await dictionaryEntriesTable.entriesByIds.query({
        ids: [a.id, b.id],
      });

      expect(map.size).toBe(2);
      expect(map.get(a.id)?.word).toBe("أ");
      expect(map.get(b.id)?.word).toBe("ب");
    });

    it("returns an empty map for an empty id list", async () => {
      const map = await dictionaryEntriesTable.entriesByIds.query({ ids: [] });
      expect(map.size).toBe(0);
    });
  });

  describe("bulkDelete", () => {
    it("deletes the requested entries and their flashcards", async () => {
      const a = await insertDictionaryEntry(testDb, { word: "أ" });
      const b = await insertDictionaryEntry(testDb, { word: "ب" });
      const kept = await insertDictionaryEntry(testDb, { word: "ج" });
      await insertFlashcard(testDb, { dictionary_entry_id: a.id });
      await insertFlashcard(testDb, {
        dictionary_entry_id: a.id,
        direction: "reverse",
      });
      await insertFlashcard(testDb, { dictionary_entry_id: kept.id });

      const deleted = await dictionaryEntriesTable.bulkDelete.mutation({
        ids: [a.id, b.id],
      });

      expect(deleted.map((entry) => entry.id).sort()).toEqual(
        [a.id, b.id].sort()
      );
      expect(
        (await dictionaryEntriesTable.list.query()).map((entry) => entry.id)
      ).toEqual([kept.id]);

      const remainingFlashcards = await (
        await testDb.db.prepare("SELECT dictionary_entry_id FROM flashcards")
      ).all([]);

      expect(remainingFlashcards).toEqual([{ dictionary_entry_id: kept.id }]);
    });

    it("skips ids that no longer exist instead of failing", async () => {
      const entry = await insertDictionaryEntry(testDb);

      const deleted = await dictionaryEntriesTable.bulkDelete.mutation({
        ids: [entry.id, "gone"],
      });

      expect(deleted.map((e) => e.id)).toEqual([entry.id]);
      expect(await dictionaryEntriesTable.list.query()).toEqual([]);
    });

    it("returns an empty list for an empty selection", async () => {
      await insertDictionaryEntry(testDb);

      expect(
        await dictionaryEntriesTable.bulkDelete.mutation({ ids: [] })
      ).toEqual([]);
      expect(await dictionaryEntriesTable.list.query()).toHaveLength(1);
    });
  });

  describe("bulkUpdateTags", () => {
    it("adds tags without duplicating existing ones", async () => {
      const a = await insertDictionaryEntry(testDb, { tags: ["daily"] });
      const b = await insertDictionaryEntry(testDb, { tags: null });

      const updated = await dictionaryEntriesTable.bulkUpdateTags.mutation({
        ids: [a.id, b.id],
        tags: ["daily", "MSA"],
        action: "add",
      });

      expect(updated).toHaveLength(2);
      expect((await dictionaryEntriesTable.entry.query(a.id)).tags).toEqual([
        "daily",
        "MSA",
      ]);
      expect((await dictionaryEntriesTable.entry.query(b.id)).tags).toEqual([
        "daily",
        "MSA",
      ]);
    });

    it("removes tags and leaves entries without them untouched", async () => {
      const a = await insertDictionaryEntry(testDb, {
        tags: ["daily", "MSA"],
        updated_at_timestamp_ms: 1000,
      });
      const b = await insertDictionaryEntry(testDb, {
        tags: ["vocabulary"],
        updated_at_timestamp_ms: 1000,
      });

      const updated = await dictionaryEntriesTable.bulkUpdateTags.mutation({
        ids: [a.id, b.id],
        tags: ["daily"],
        action: "remove",
      });

      expect(updated.map((entry) => entry.id)).toEqual([a.id]);
      expect((await dictionaryEntriesTable.entry.query(a.id)).tags).toEqual([
        "MSA",
      ]);

      // b had none of the removed tags, so it keeps its original updated_at.
      const untouched = await dictionaryEntriesTable.entry.query(b.id);
      expect(untouched.tags).toEqual(["vocabulary"]);
      expect(untouched.updated_at_timestamp_ms).toBe(1000);
    });

    it("clears the column when the last tag is removed", async () => {
      const entry = await insertDictionaryEntry(testDb, { tags: ["daily"] });

      await dictionaryEntriesTable.bulkUpdateTags.mutation({
        ids: [entry.id],
        tags: ["daily"],
        action: "remove",
      });

      expect((await dictionaryEntriesTable.entry.query(entry.id)).tags).toBe(
        null
      );
    });

    it("does nothing when no tags are passed", async () => {
      const entry = await insertDictionaryEntry(testDb, { tags: ["daily"] });

      expect(
        await dictionaryEntriesTable.bulkUpdateTags.mutation({
          ids: [entry.id],
          tags: [],
          action: "add",
        })
      ).toEqual([]);
      expect((await dictionaryEntriesTable.entry.query(entry.id)).tags).toEqual(
        ["daily"]
      );
    });
  });

  describe("tagsForEntries", () => {
    it("counts how many of the selected entries carry each tag", async () => {
      const a = await insertDictionaryEntry(testDb, {
        tags: ["daily", "MSA"],
      });
      const b = await insertDictionaryEntry(testDb, { tags: ["daily"] });
      await insertDictionaryEntry(testDb, { tags: ["unselected"] });

      const result = await dictionaryEntriesTable.tagsForEntries.query({
        ids: [a.id, b.id],
      });

      expect(result).toEqual([
        { tag: "daily", count: 2 },
        { tag: "MSA", count: 1 },
      ]);
    });

    it("counts a tag repeated within one entry once", async () => {
      const entry = await insertDictionaryEntry(testDb, {
        tags: ["daily", "daily"],
      });

      expect(
        await dictionaryEntriesTable.tagsForEntries.query({ ids: [entry.id] })
      ).toEqual([{ tag: "daily", count: 1 }]);
    });

    it("returns an empty list for an empty selection", async () => {
      expect(
        await dictionaryEntriesTable.tagsForEntries.query({ ids: [] })
      ).toEqual([]);
    });
  });

  describe("list", () => {
    it("returns entries newest-first, paginated", async () => {
      await insertDictionaryEntry(testDb, { created_at_timestamp_ms: 1000 });
      await insertDictionaryEntry(testDb, { created_at_timestamp_ms: 3000 });
      await insertDictionaryEntry(testDb, { created_at_timestamp_ms: 2000 });

      const all = await dictionaryEntriesTable.list.query();
      expect(all.map((e) => e.created_at_timestamp_ms)).toEqual([
        3000, 2000, 1000,
      ]);

      const page = await dictionaryEntriesTable.list.query({
        limit: 1,
        offset: 1,
      });
      expect(page.map((e) => e.created_at_timestamp_ms)).toEqual([2000]);
    });
  });
});
