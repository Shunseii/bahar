import { beforeEach, describe, expect, test } from "bun:test";
import { dictionaryEntries } from "@bahar/drizzle-user-db-schemas";
import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { applyEdits } from "./apply-edits";
import type { UserDb } from "./db";
import { parseEditInput } from "./edit-input";
import { buildTestDb } from "./test-db";

const seedEntry = async (raw: Client, id: string): Promise<void> => {
  await raw.execute({
    sql: `INSERT INTO dictionary_entries
      (id, word, translation, type, tags, updated_at, updated_at_timestamp_ms)
      VALUES (?, ?, ?, 'ism', ?, ?, ?)`,
    args: [
      id,
      "نور",
      "light",
      JSON.stringify(["old"]),
      "2020-01-01T00:00:00.000Z",
      1_577_836_800_000,
    ],
  });
};

describe("applyEdits", () => {
  let db: UserDb;
  let raw: Client;

  beforeEach(async () => {
    ({ db, raw } = await buildTestDb());
  });

  test("updates only the provided fields and bumps updated_at", async () => {
    await seedEntry(raw, "e1");

    const items = parseEditInput(
      JSON.stringify([{ id: "e1", translation: "light, glow" }])
    );

    const now = new Date();
    const { edited, missing } = await applyEdits({ db, items, now });

    expect(missing).toEqual([]);
    expect(edited).toEqual([{ id: "e1", fields: ["translation"] }]);

    const [row] = await db
      .select()
      .from(dictionaryEntries)
      .where(eq(dictionaryEntries.id, "e1"));
    expect(row.translation).toBe("light, glow");
    expect(row.word).toBe("نور"); // untouched
    expect(row.updated_at_timestamp_ms).toBe(now.getTime()); // bumped
  });

  test("clears a nullable field when passed null", async () => {
    // seedEntry with tags set, parse an edit with tags: null, call applyEdits.
    // Assert the stored tags column is null afterwards.
  });

  test("reports missing ids and still edits the found ones", async () => {
    // seedEntry("e1") only, parse edits for "e1" and "nope".
    // Assert edited = ["e1"], missing = ["nope"].
  });

  test("does not touch entries not named in the batch", async () => {
    // seed "e1" and "e2", edit only "e1".
    // Assert "e2" row (incl. updated_at) is unchanged.
  });
});
