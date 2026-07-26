import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createTestDb,
  type TestDb,
} from "@bahar/db-operations/src/test/create-test-db";
import type {
  RawDictionaryEntry,
  SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { transformForExport } from "../export";
import { importEntries, parseImportData } from "./index";
import type { ImportWordV1 } from "./v1/schema";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "v1");

const readFixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8"));

/**
 * Mirrors the export loop in the settings route: read every entry with its
 * flashcards ordered by direction, and transform each one.
 */
const exportAll = async ({
  db,
  includeFlashcards,
}: {
  db: TestDb["db"];
  includeFlashcards: boolean;
}): Promise<ImportWordV1[]> => {
  const entries: RawDictionaryEntry[] = await db.all(
    "SELECT * FROM dictionary_entries"
  );

  const exported: ImportWordV1[] = [];

  for (const entry of entries) {
    const flashcards: SelectFlashcard[] = await db.all(
      "SELECT * FROM flashcards WHERE dictionary_entry_id = ? ORDER BY direction",
      [entry.id]
    );

    const result = transformForExport({ entry, flashcards, includeFlashcards });

    if (!result.ok) {
      throw new Error(
        `Export failed for ${entry.id}: ${result.error.field} ${result.error.reason}`
      );
    }

    exported.push(result.value);
  }

  return exported;
};

/**
 * The same two calls the settings route makes: validate the file, then write it.
 */
const importAll = async ({
  db,
  data,
  createReverseByDefault = false,
}: {
  db: TestDb["db"];
  data: unknown;
  createReverseByDefault?: boolean;
}) => {
  const { version, entries } = parseImportData(data);

  return importEntries({ db, entries, version, createReverseByDefault });
};

type CardRow = {
  direction: string;
  difficulty: number | null;
  due: string;
  due_timestamp_ms: number;
  last_review: string | null;
  reps: number | null;
  state: number | null;
  is_hidden: number | null;
  learning_steps: number | null;
};

const cardsOf = async (
  db: TestDb["db"],
  entryId: string
): Promise<CardRow[]> => {
  const rows: CardRow[] = await db.all(
    "SELECT direction, difficulty, due, due_timestamp_ms, last_review, reps, state, is_hidden, learning_steps FROM flashcards WHERE dictionary_entry_id = ? ORDER BY direction",
    [entryId]
  );

  return rows;
};

const allCards = async (db: TestDb["db"]): Promise<{ direction: string }[]> => {
  const rows: { direction: string }[] = await db.all(
    "SELECT direction FROM flashcards"
  );

  return rows;
};

const allEntryIds = async (db: TestDb["db"]): Promise<{ id: string }[]> => {
  const rows: { id: string }[] = await db.all(
    "SELECT id FROM dictionary_entries"
  );

  return rows;
};

const entryRow = async (
  db: TestDb["db"],
  entryId: string
): Promise<RawDictionaryEntry> => {
  const rows: RawDictionaryEntry[] = await db.all(
    "SELECT * FROM dictionary_entries WHERE id = ?",
    [entryId]
  );

  return rows[0];
};

const directionsOf = async (db: TestDb["db"], entryId: string) =>
  (await cardsOf(db, entryId)).map((card) => card.direction);

const REVIEWED_AT = "2025-11-25T04:26:40.315Z";
const DUE_AT = "2025-12-01T04:26:40.315Z";

const seedEntry = async (
  db: TestDb["db"],
  {
    id,
    word = "كتاب",
    translation = "book",
  }: { id: string; word?: string; translation?: string }
) => {
  await db.run(
    `INSERT INTO dictionary_entries
       (id, word, translation, definition, type, root, tags, antonyms, examples, morphology,
        created_at, created_at_timestamp_ms, updated_at, updated_at_timestamp_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      word,
      translation,
      "ما يُكتب فيه",
      "ism",
      JSON.stringify(["ك", "ت", "ب"]),
      JSON.stringify(["معهد الخليل"]),
      JSON.stringify([{ word: "قلم" }]),
      JSON.stringify([{ sentence: "قرأت الكتاب" }]),
      JSON.stringify({ ism: { gender: "masculine" } }),
      "2025-11-12T04:26:40.315Z",
      Date.parse("2025-11-12T04:26:40.315Z"),
      "2025-11-20T04:26:40.315Z",
      Date.parse("2025-11-20T04:26:40.315Z"),
    ]
  );
};

const seedCard = async (
  db: TestDb["db"],
  {
    id,
    entryId,
    direction,
    reps = 7,
    state = 2,
    difficulty = 6.32,
    learningSteps = 0,
  }: {
    id: string;
    entryId: string;
    direction: "forward" | "reverse";
    reps?: number;
    state?: number;
    difficulty?: number;
    learningSteps?: number;
  }
) => {
  await db.run(
    `INSERT INTO flashcards
       (id, dictionary_entry_id, difficulty, due, due_timestamp_ms, elapsed_days, lapses,
        last_review, last_review_timestamp_ms, reps, scheduled_days, stability, state,
        direction, is_hidden, learning_steps)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entryId,
      difficulty,
      DUE_AT,
      Date.parse(DUE_AT),
      4,
      2,
      REVIEWED_AT,
      Date.parse(REVIEWED_AT),
      reps,
      11,
      18.5,
      state,
      direction,
      0,
      learningSteps,
    ]
  );
};

describe("export -> import round trip against the real schema", () => {
  let source: TestDb;
  let target: TestDb;

  beforeEach(async () => {
    source = await createTestDb();
    target = await createTestDb();
  });

  afterEach(async () => {
    await source.close();
    await target.close();
  });

  it("keeps a forward-only entry forward-only", async () => {
    await seedEntry(source.db, { id: "e-fwd" });
    await seedCard(source.db, {
      id: "c-fwd",
      entryId: "e-fwd",
      direction: "forward",
    });

    const exported = await exportAll({
      db: source.db,
      includeFlashcards: true,
    });
    await importAll({ db: target.db, data: exported });

    // The regression this suite exists for: a reverse card must not appear out
    // of nowhere on the far side of a round trip.
    expect(await directionsOf(target.db, "e-fwd")).toEqual(["forward"]);
  });

  it("carries both cards and their distinct FSRS state across", async () => {
    await seedEntry(source.db, { id: "e-both" });
    await seedCard(source.db, {
      id: "c-both-fwd",
      entryId: "e-both",
      direction: "forward",
      reps: 9,
      difficulty: 7.5,
    });
    await seedCard(source.db, {
      id: "c-both-rev",
      entryId: "e-both",
      direction: "reverse",
      reps: 3,
      difficulty: 4.1,
    });

    const exported = await exportAll({
      db: source.db,
      includeFlashcards: true,
    });
    await importAll({ db: target.db, data: exported });

    const cards = await cardsOf(target.db, "e-both");

    expect(cards.map((card) => card.direction)).toEqual(["forward", "reverse"]);
    expect(cards[0]).toMatchObject({
      reps: 9,
      difficulty: 7.5,
      state: 2,
      due: DUE_AT,
      last_review: REVIEWED_AT,
      is_hidden: 0,
    });
    expect(cards[1]).toMatchObject({ reps: 3, difficulty: 4.1, state: 2 });
  });

  it("carries a mid-learning card's step position across", async () => {
    await seedEntry(source.db, { id: "e-steps" });
    await seedCard(source.db, {
      id: "c-steps",
      entryId: "e-steps",
      direction: "forward",
      state: 1,
      learningSteps: 2,
    });

    const exported = await exportAll({
      db: source.db,
      includeFlashcards: true,
    });
    await importAll({ db: target.db, data: exported });

    const [card] = await cardsOf(target.db, "e-steps");

    // Dropping this column would silently restart the card's learning sequence.
    expect(card).toMatchObject({ state: 1, learning_steps: 2 });
  });

  it("clears a stale step position when the imported card is fresh", async () => {
    await seedEntry(source.db, { id: "e-stale" });
    await seedCard(source.db, {
      id: "c-stale-src",
      entryId: "e-stale",
      direction: "forward",
      state: 0,
      reps: 0,
      learningSteps: 0,
    });

    await seedEntry(target.db, { id: "e-stale" });
    await seedCard(target.db, {
      id: "c-stale-existing",
      entryId: "e-stale",
      direction: "forward",
      state: 1,
      reps: 9,
      learningSteps: 3,
    });

    const exported = await exportAll({
      db: source.db,
      includeFlashcards: true,
    });
    await importAll({ db: target.db, data: exported });

    const [card] = await cardsOf(target.db, "e-stale");

    // The upsert resets the rest of the FSRS state, so the step position has to
    // come along or the card claims NEW while sitting three steps into learning.
    expect(card).toMatchObject({ state: 0, reps: 0, learning_steps: 0 });
  });

  it("preserves the entry's own columns, including parsed json fields", async () => {
    await seedEntry(source.db, { id: "e-cols" });
    await seedCard(source.db, {
      id: "c-cols",
      entryId: "e-cols",
      direction: "forward",
    });

    const exported = await exportAll({
      db: source.db,
      includeFlashcards: true,
    });
    await importAll({ db: target.db, data: exported });

    const row = await entryRow(target.db, "e-cols");

    expect(row).toMatchObject({
      word: "كتاب",
      translation: "book",
      definition: "ما يُكتب فيه",
      type: "ism",
      created_at: "2025-11-12T04:26:40.315Z",
      updated_at: "2025-11-20T04:26:40.315Z",
    });
    expect(JSON.parse(row.root ?? "null")).toEqual(["ك", "ت", "ب"]);
    expect(JSON.parse(row.tags ?? "null")).toEqual(["معهد الخليل"]);
    expect(JSON.parse(row.antonyms ?? "null")).toEqual([{ word: "قلم" }]);
    expect(JSON.parse(row.examples ?? "null")).toEqual([
      { sentence: "قرأت الكتاب" },
    ]);
    expect(JSON.parse(row.morphology ?? "null")).toEqual({
      ism: { gender: "masculine" },
    });

    // The export drops sub-second precision, so the ms columns come back
    // truncated to the second rather than byte-identical.
    expect(row.created_at_timestamp_ms).toBe(
      Math.floor(Date.parse("2025-11-12T04:26:40.315Z") / 1000) * 1000
    );
  });

  describe("an export taken without flashcards", () => {
    it("creates only a forward card when the account default is off", async () => {
      await seedEntry(source.db, { id: "e-nofc" });
      await seedCard(source.db, {
        id: "c-nofc",
        entryId: "e-nofc",
        direction: "forward",
      });

      const exported = await exportAll({
        db: source.db,
        includeFlashcards: false,
      });
      await importAll({
        db: target.db,
        data: exported,
        createReverseByDefault: false,
      });

      expect(await directionsOf(target.db, "e-nofc")).toEqual(["forward"]);
    });

    it("creates both cards when the account default is on", async () => {
      await seedEntry(source.db, { id: "e-nofc-on" });

      const exported = await exportAll({
        db: source.db,
        includeFlashcards: false,
      });
      await importAll({
        db: target.db,
        data: exported,
        createReverseByDefault: true,
      });

      const cards = await cardsOf(target.db, "e-nofc-on");

      expect(cards.map((card) => card.direction)).toEqual([
        "forward",
        "reverse",
      ]);
      // Nothing to restore, so both cards start from scratch and are visible.
      for (const card of cards) {
        expect(card).toMatchObject({
          reps: 0,
          state: 0,
          last_review: null,
          is_hidden: 0,
        });
      }
    });
  });

  describe("re-importing the same file", () => {
    it("keeps one row per direction instead of duplicating cards", async () => {
      await seedEntry(source.db, { id: "e-dup" });
      await seedCard(source.db, {
        id: "c-dup-fwd",
        entryId: "e-dup",
        direction: "forward",
      });
      await seedCard(source.db, {
        id: "c-dup-rev",
        entryId: "e-dup",
        direction: "reverse",
      });

      const exported = await exportAll({
        db: source.db,
        includeFlashcards: true,
      });

      await importAll({ db: target.db, data: exported });
      await importAll({ db: target.db, data: exported });

      // Proves both ON CONFLICT targets resolve to real constraints -- a missing
      // unique index would show up here as duplicated rows.
      expect(await directionsOf(target.db, "e-dup")).toEqual([
        "forward",
        "reverse",
      ]);
      expect(await allEntryIds(target.db)).toHaveLength(1);
    });

    it("overwrites the entry and card state already in the database", async () => {
      await seedEntry(source.db, {
        id: "e-over",
        word: "قلم",
        translation: "pen",
      });
      await seedCard(source.db, {
        id: "c-over",
        entryId: "e-over",
        direction: "forward",
        reps: 12,
        difficulty: 8.25,
      });

      // Target already holds an older, different version of the same entry.
      await seedEntry(target.db, {
        id: "e-over",
        word: "stale",
        translation: "stale",
      });
      await seedCard(target.db, {
        id: "c-over-existing",
        entryId: "e-over",
        direction: "forward",
        reps: 1,
        difficulty: 1.5,
      });

      const exported = await exportAll({
        db: source.db,
        includeFlashcards: true,
      });
      await importAll({ db: target.db, data: exported });

      const row = await entryRow(target.db, "e-over");
      expect(row).toMatchObject({ word: "قلم", translation: "pen" });

      const cards = await cardsOf(target.db, "e-over");
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ reps: 12, difficulty: 8.25 });
    });

    it("leaves an existing reverse card alone when the file is forward-only", async () => {
      await seedEntry(source.db, { id: "e-keep" });
      await seedCard(source.db, {
        id: "c-keep-fwd",
        entryId: "e-keep",
        direction: "forward",
      });

      await seedEntry(target.db, { id: "e-keep" });
      await seedCard(target.db, {
        id: "c-keep-rev",
        entryId: "e-keep",
        direction: "reverse",
        reps: 5,
      });

      const exported = await exportAll({
        db: source.db,
        includeFlashcards: true,
      });
      await importAll({ db: target.db, data: exported });

      // Import is a merge, not a mirror: dropping the reverse row would discard
      // the FSRS progress on it, so the card stays with its own state.
      const cards = await cardsOf(target.db, "e-keep");
      expect(cards.map((card) => card.direction)).toEqual([
        "forward",
        "reverse",
      ]);
      expect(cards[1]).toMatchObject({ reps: 5 });
    });
  });

  it("rejects an entry with no word type before writing anything", async () => {
    const data = [{ id: "e-untyped", word: "قلم", translation: "pen" }];

    // `dictionary_entries.type` is NOT NULL. Catching this during validation
    // keeps it from surfacing as a constraint violation part-way through the
    // insert transaction, which would take the rest of the batch down with it.
    await expect(importAll({ db: target.db, data })).rejects.toThrow(
      "Invalid v1 import data"
    );

    expect(await allEntryIds(target.db)).toHaveLength(0);
  });

  describe("committed sample exports", () => {
    it("imports the with-flashcards fixture, one card per direction it contains", async () => {
      const data = readFixture("v1_sample_export_with_flashcards.json");

      await importAll({ db: target.db, data });

      const entries = await allEntryIds(target.db);
      const cards = await allCards(target.db);

      expect(entries).toHaveLength(495);
      // Every entry in this fixture carries both a forward and a reverse card.
      expect(cards).toHaveLength(990);
      expect(cards.filter((card) => card.direction === "reverse")).toHaveLength(
        495
      );
    });

    it("imports the without-flashcards fixture as forward-only by default", async () => {
      const data = readFixture("v1_sample_export_without_flashcards.json");

      await importAll({ db: target.db, data });

      const cards = await allCards(target.db);

      expect(cards).toHaveLength(495);
      expect(cards.every((card) => card.direction === "forward")).toBe(true);
    });

    it("gives every entry a reverse card when the fixture has none and the default is on", async () => {
      const data = readFixture("v1_sample_export_without_flashcards.json");

      await importAll({ db: target.db, data, createReverseByDefault: true });

      const cards = await allCards(target.db);

      expect(cards).toHaveLength(990);
    });
  });
});
