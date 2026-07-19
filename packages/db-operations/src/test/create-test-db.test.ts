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

    const stmt = await testDb.db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    const tables = (await stmt.all()) as { name: string }[];
    const tableNames = tables.map((row) => row.name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        "decks",
        "dictionary_entries",
        "flashcards",
        "settings",
        "user_stats",
      ])
    );
  });

  it("runs real writes and reads through the drizzle instance", async () => {
    testDb = await createTestDb();

    await testDb.drizzleDb.insert(settings).values({
      id: "settings-1",
      show_antonyms_in_flashcard: "hidden",
      create_reverse_by_default: false,
    });

    const [row] = await testDb.drizzleDb.select().from(settings);

    expect(row).toMatchObject({
      id: "settings-1",
      show_antonyms_in_flashcard: "hidden",
      create_reverse_by_default: false,
    });
  });

  it("an explicit alias disambiguates same-named columns across a join", async () => {
    // Mirrors the web harness regression: a bare, unaliased select of both
    // flashcards.id and dictionaryEntries.id (both compile to "id") would
    // collapse in the name-keyed row and misalign every later value. The
    // sql`...`.as() alias is the driver-agnostic fix shared by web, mobile,
    // and this harness.
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

    await testDb.drizzleDb.insert(settings).values({
      id: "settings-1",
      show_antonyms_in_flashcard: "hidden",
      create_reverse_by_default: false,
    });

    const other = await createTestDb();
    try {
      const rows = await other.drizzleDb.select().from(settings);
      expect(rows).toEqual([]);
    } finally {
      await other.close();
    }
  });
});
