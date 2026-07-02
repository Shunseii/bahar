import { settings } from "@bahar/drizzle-user-db-schemas";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./create-test-db";

describe("createTestDb", () => {
  let testDb: TestDb | undefined;

  afterEach(async () => {
    await testDb?.close();
    testDb = undefined;
  });

  it("applies migrations so the schema tables exist", async () => {
    testDb = await createTestDb();

    const tables = await testDb.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      )
      .all();

    const tableNames = tables.map((row: { name: string }) => row.name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        "decks",
        "dictionary_entries",
        "flashcards",
        "settings",
      ])
    );
  });

  it("runs real writes and reads through the raw db handle", async () => {
    testDb = await createTestDb();

    await testDb.db
      .prepare("INSERT INTO decks (id, name, filters) VALUES (?, ?, ?);")
      .run(["deck-1", "Test Deck", null]);

    const deck = await testDb.db
      .prepare("SELECT * FROM decks WHERE id = ?;")
      .get(["deck-1"]);

    expect(deck).toEqual({ id: "deck-1", name: "Test Deck", filters: null });
  });

  it("runs real writes and reads through the drizzle instance", async () => {
    testDb = await createTestDb();

    await testDb.drizzleDb.insert(settings).values({
      id: "settings-1",
      show_antonyms_in_flashcard: "hidden",
      show_reverse_flashcards: false,
    });

    const rows = await testDb.db.prepare("SELECT * FROM settings;").all();

    expect(rows).toEqual([
      {
        id: "settings-1",
        show_antonyms_in_flashcard: "hidden",
        show_reverse_flashcards: 0,
      },
    ]);
  });

  it("gives each createTestDb() call an isolated database", async () => {
    testDb = await createTestDb();

    await testDb.db
      .prepare("INSERT INTO decks (id, name, filters) VALUES (?, ?, ?);")
      .run(["deck-1", "Test Deck", null]);

    const otherDb = await createTestDb();

    try {
      const decks = await otherDb.db.prepare("SELECT * FROM decks;").all();
      expect(decks).toEqual([]);
    } finally {
      await otherDb.close();
    }
  });
});
