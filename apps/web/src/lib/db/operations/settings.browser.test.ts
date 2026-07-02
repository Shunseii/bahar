import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import { insertSettings } from "../test/factories";

const dbRef = vi.hoisted(() => ({ current: undefined as TestDb | undefined }));

vi.mock("..", async (importOriginal) => ({
  ...(await importOriginal()),
  ensureDb: vi.fn(async () => dbRef.current?.db),
  getDb: vi.fn(() => dbRef.current?.db),
  getDrizzleDb: vi.fn(() => dbRef.current?.drizzleDb),
}));

const { settingsTable } = await import("./settings");

describe("settingsTable", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbRef.current = testDb;
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("getSettings", () => {
    it("creates and returns default settings when none exist yet", async () => {
      const settings = await settingsTable.getSettings.query();

      expect(settings).toEqual({
        show_antonyms_in_flashcard: "hidden",
        show_reverse_flashcards: false,
      });

      const row = await testDb.db.prepare("SELECT * FROM settings").get();

      expect(row).toBeDefined();
    });

    it("returns existing settings when a row already exists", async () => {
      await insertSettings(testDb, {
        show_antonyms_in_flashcard: "hint",
        show_reverse_flashcards: true,
      });

      const settings = await settingsTable.getSettings.query();

      expect(settings).toEqual({
        show_antonyms_in_flashcard: "hint",
        show_reverse_flashcards: true,
      });
    });
  });

  describe("update", () => {
    it("updates only the provided fields, leaving others untouched", async () => {
      await insertSettings(testDb, {
        show_antonyms_in_flashcard: "hidden",
        show_reverse_flashcards: false,
      });

      const updated = await settingsTable.update.mutation({
        updates: { show_reverse_flashcards: true },
      });

      expect(updated).toEqual({
        show_antonyms_in_flashcard: "hidden",
        show_reverse_flashcards: true,
      });

      const row = await testDb.db.prepare("SELECT * FROM settings").get();

      expect(row.show_reverse_flashcards).toBe(1);
      expect(row.show_antonyms_in_flashcard).toBe("hidden");
    });

    it("updates the show_antonyms_in_flashcard field", async () => {
      await insertSettings(testDb, {
        show_antonyms_in_flashcard: "hidden",
        show_reverse_flashcards: false,
      });

      const updated = await settingsTable.update.mutation({
        updates: { show_antonyms_in_flashcard: "hint" },
      });

      expect(updated).toEqual({
        show_antonyms_in_flashcard: "hint",
        show_reverse_flashcards: false,
      });

      const row = await testDb.db.prepare("SELECT * FROM settings").get();

      expect(row.show_antonyms_in_flashcard).toBe("hint");
      expect(row.show_reverse_flashcards).toBe(0);
    });

    it("throws when no fields are provided", async () => {
      await insertSettings(testDb);

      const updateResult = settingsTable.update.mutation({ updates: {} });

      await expect(updateResult).rejects.toThrow("No fields to update");
    });
  });

  describe("update called before any settings row exists", () => {
    it("throws a controlled error instead of crashing", async () => {
      const updateResult = settingsTable.update.mutation({
        updates: { show_reverse_flashcards: true },
      });

      await expect(updateResult).rejects.toThrow("Settings not found");
    });
  });
});
