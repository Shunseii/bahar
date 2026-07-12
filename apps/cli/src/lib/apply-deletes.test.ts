import { beforeEach, describe, expect, test } from "bun:test";
import { dictionaryEntries, flashcards } from "@bahar/drizzle-user-db-schemas";
import type { Client } from "@libsql/client";
import { applyDeletes } from "./apply-deletes";
import type { UserDb } from "./db";
import { buildTestDb } from "./test-db";

const seedEntryWithCards = async (raw: Client, id: string): Promise<void> => {
  await raw.execute({
    sql: "INSERT INTO dictionary_entries (id, word, translation, type) VALUES (?, ?, ?, 'ism')",
    args: [id, "نور", "light"],
  });
  for (const direction of ["forward", "reverse"] as const) {
    await raw.execute({
      sql: `INSERT INTO flashcards
        (id, dictionary_entry_id, due, due_timestamp_ms, direction, is_hidden,
         state, reps, lapses, stability, difficulty, scheduled_days, elapsed_days, learning_steps)
        VALUES (?, ?, '2026-01-01T00:00:00.000Z', 1767225600000, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
      args: [`${id}-${direction}`, id, direction],
    });
  }
};

describe("applyDeletes", () => {
  let db: UserDb;
  let raw: Client;

  beforeEach(async () => {
    ({ db, raw } = await buildTestDb());
  });

  test("deletes entries and their flashcards", async () => {
    await seedEntryWithCards(raw, "e1");

    const { deleted, missing } = await applyDeletes({ db, ids: ["e1"] });

    expect(deleted).toEqual([{ id: "e1", word: "نور" }]);
    expect(missing).toEqual([]);

    expect(await db.select().from(dictionaryEntries)).toHaveLength(0);
    expect(await db.select().from(flashcards)).toHaveLength(0);
  });

  test("reports missing ids and still deletes the found ones", async () => {
    // seedEntryWithCards("e1"), call applyDeletes with ["e1", "nope"].
    // Assert deleted = ["e1"], missing = ["nope"].
  });

  test("only deletes the named entries, leaving others intact", async () => {
    // seed "e1" and "e2" (with cards), delete only "e1".
    // Assert "e2" and its two cards still exist.
  });
});
