import {
  dictionaryEntries,
  flashcards,
  settings,
} from "@bahar/drizzle-user-db-schemas";
import { eq, sql } from "drizzle-orm";
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

    const tables = await testDb.db.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );

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

    await testDb.db.run(
      "INSERT INTO decks (id, name, filters) VALUES (?, ?, ?);",
      ["deck-1", "Test Deck", null]
    );

    const deck = await testDb.db.get("SELECT * FROM decks WHERE id = ?;", [
      "deck-1",
    ]);

    expect(deck).toEqual({ id: "deck-1", name: "Test Deck", filters: null });
  });

  it("runs real writes and reads through the drizzle instance", async () => {
    testDb = await createTestDb();

    await testDb.drizzleDb.insert(settings).values({
      id: "settings-1",
      show_antonyms_in_flashcard: "hidden",
      create_reverse_by_default: false,
    });

    const rows = await testDb.db.all("SELECT * FROM settings;");

    // Raw SELECT * returns the real SQL column name (`show_reverse_flashcards`),
    // not the Drizzle field alias (`create_reverse_by_default`) used on insert
    // above. The column was repurposed via alias, never renamed (BAH-161).
    expect(rows).toEqual([
      {
        id: "settings-1",
        show_antonyms_in_flashcard: "hidden",
        show_reverse_flashcards: 0,
      },
    ]);
  });

  it("an explicit alias correctly disambiguates same-named columns across a join", async () => {
    // drizzle's sqlite-proxy protocol doesn't emit SQL aliases to guarantee
    // unique column names across a join -- a bare, unaliased select of both
    // flashcards.id and dictionaryEntries.id (both literally "id" in the
    // compiled SQL) silently collapses in a name-keyed row object, dropping
    // one and misaligning every value selected after it. This broke
    // flashcardsTable.today's nested dictionary_entry select.
    //
    // There's no automatic protection against this (the adapter returns
    // name-keyed rows, matched to web and mobile alike) -- every query that
    // selects plain columns from both sides of a join into the same output
    // must explicitly alias any name that could collide, via
    // sql<T>`column`.as("uniqueName"). This test documents and pins down
    // that the supported pattern actually works.
    testDb = await createTestDb();

    await testDb.drizzleDb.insert(dictionaryEntries).values({
      id: "entry-1",
      word: "كتاب",
      translation: "book",
      type: "ism",
    });
    await testDb.drizzleDb.insert(flashcards).values({
      id: "flashcard-1",
      dictionary_entry_id: "entry-1",
      due: "2026-01-01T00:00:00.000Z",
      due_timestamp_ms: 0,
    });

    const [row] = await testDb.drizzleDb
      .select({
        flashcardId: flashcards.id,
        entryId: sql<string>`${dictionaryEntries.id}`.as("entry_id"),
        word: dictionaryEntries.word,
      })
      .from(flashcards)
      .innerJoin(
        dictionaryEntries,
        eq(flashcards.dictionary_entry_id, dictionaryEntries.id)
      )
      .where(eq(flashcards.id, "flashcard-1"));

    expect(row).toEqual({
      flashcardId: "flashcard-1",
      entryId: "entry-1",
      word: "كتاب",
    });
  });

  it("gives each createTestDb() call an isolated database", async () => {
    testDb = await createTestDb();

    await testDb.db.run(
      "INSERT INTO decks (id, name, filters) VALUES (?, ?, ?);",
      ["deck-1", "Test Deck", null]
    );

    const otherDb = await createTestDb();

    try {
      const decks = await otherDb.db.all("SELECT * FROM decks;");
      expect(decks).toEqual([]);
    } finally {
      await otherDb.close();
    }
  });
});
