import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import { insertSettings } from "../test/factories";
import { makeSettingsTable } from "./settings";

describe("settingsTable", () => {
  let testDb: TestDb;
  let settingsTable: ReturnType<typeof makeSettingsTable>;

  beforeEach(async () => {
    testDb = await createTestDb();
    settingsTable = makeSettingsTable({ getDb: async () => testDb.drizzleDb });
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("getSettings", () => {
    it("creates and returns default settings when none exist yet", async () => {
      const result = await settingsTable.getSettings.query();

      expect(result).toEqual({
        show_antonyms_in_flashcard: "hidden",
        create_reverse_by_default: false,
      });

      const row = await (
        await testDb.db.prepare("SELECT * FROM settings")
      ).get();

      expect(row).toBeDefined();
    });

    it("returns existing settings when a row already exists", async () => {
      await insertSettings(testDb, {
        show_antonyms_in_flashcard: "hint",
        create_reverse_by_default: true,
      });

      const result = await settingsTable.getSettings.query();

      expect(result).toEqual({
        show_antonyms_in_flashcard: "hint",
        create_reverse_by_default: true,
      });
    });
  });

  describe("update", () => {
    it("updates only the provided fields, leaving others untouched", async () => {
      await insertSettings(testDb, {
        show_antonyms_in_flashcard: "hidden",
        create_reverse_by_default: false,
      });

      const updated = await settingsTable.update.mutation({
        updates: { create_reverse_by_default: true },
      });

      expect(updated).toEqual({
        show_antonyms_in_flashcard: "hidden",
        create_reverse_by_default: true,
      });

      // Raw read: the underlying SQL column is still `show_reverse_flashcards`
      // (the Drizzle field `create_reverse_by_default` is an alias -- the column
      // was never renamed). Confirms the alias writes through to the real column.
      const row = (await (
        await testDb.db.prepare("SELECT * FROM settings")
      ).get()) as {
        show_reverse_flashcards: number;
        show_antonyms_in_flashcard: string;
      };

      expect(row.show_reverse_flashcards).toBe(1);
      expect(row.show_antonyms_in_flashcard).toBe("hidden");
    });

    it("updates the show_antonyms_in_flashcard field", async () => {
      await insertSettings(testDb, {
        show_antonyms_in_flashcard: "hidden",
        create_reverse_by_default: false,
      });

      const updated = await settingsTable.update.mutation({
        updates: { show_antonyms_in_flashcard: "hint" },
      });

      expect(updated).toEqual({
        show_antonyms_in_flashcard: "hint",
        create_reverse_by_default: false,
      });
    });

    it("throws when no fields are provided", async () => {
      await insertSettings(testDb);

      await expect(
        settingsTable.update.mutation({ updates: {} })
      ).rejects.toThrow("No fields to update");
    });

    it("throws a controlled error when no settings row exists", async () => {
      await expect(
        settingsTable.update.mutation({
          updates: { create_reverse_by_default: true },
        })
      ).rejects.toThrow("Settings not found");
    });
  });
});
