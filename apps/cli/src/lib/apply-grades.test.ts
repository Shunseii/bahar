import { beforeEach, describe, expect, test } from "bun:test";
import * as schema from "@bahar/drizzle-user-db-schemas";
import { flashcards, userStats } from "@bahar/drizzle-user-db-schemas";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { applyGrades } from "./apply-grades";
import type { UserDb } from "./db";
import { parseGradeInput } from "./grade-input";

const MIGRATIONS_DIR = new URL(
  "../../../../packages/drizzle-user-db-schemas/drizzle/",
  import.meta.url
);
const MIGRATION_FILES = [
  "0000_complete_changeling.sql",
  "0001_even_kitty_pryde.sql",
  "0002_watery_blink.sql",
  "0003_tearful_marten_broadcloak.sql",
];

const buildDb = async (): Promise<{
  db: UserDb;
  raw: ReturnType<typeof createClient>;
}> => {
  const raw = createClient({ url: ":memory:" });

  for (const file of MIGRATION_FILES) {
    const sql = await Bun.file(new URL(file, MIGRATIONS_DIR)).text();
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await raw.execute(statement);
    }
  }

  const db = drizzle(raw, { schema }) as unknown as UserDb;
  return { db, raw };
};

const seedCard = async (
  raw: ReturnType<typeof createClient>,
  id: string
): Promise<void> => {
  // Each card needs its own dictionary entry: flashcards are unique on
  // (dictionary_entry_id, direction), and there is a FK to dictionary_entries.
  const entryId = `entry-${id}`;
  await raw.execute({
    sql: "INSERT INTO dictionary_entries (id, word, translation, type) VALUES (?, ?, ?, ?)",
    args: [entryId, "نور", "light", "ism"],
  });

  // A card in the review state, due in the past.
  const past = Date.now() - 5 * 24 * 60 * 60 * 1000;
  await raw.execute({
    sql: `INSERT INTO flashcards
      (id, dictionary_entry_id, due, due_timestamp_ms, direction, is_hidden,
       state, reps, lapses, stability, difficulty, scheduled_days, elapsed_days, learning_steps)
      VALUES (?, ?, ?, ?, 'forward', 0, 2, 3, 0, 10.5, 6.0, 5, 5, 0)`,
    args: [id, entryId, new Date(past).toISOString(), past],
  });
};

describe("applyGrades", () => {
  let db: UserDb;
  let raw: ReturnType<typeof createClient>;

  beforeEach(async () => {
    ({ db, raw } = await buildDb());
  });

  test("grades many cards in one batch and pushes their due dates out", async () => {
    await seedCard(raw, "card-a");
    await seedCard(raw, "card-b");

    const items = parseGradeInput({
      positional: ["card-a", "card-b", "good"],
      stdin: null,
    });

    const now = new Date();
    const { results, missing, revlogEntries } = await applyGrades({
      db,
      items,
      now,
    });

    expect(missing).toEqual([]);
    expect(results.map((r) => r.id).sort()).toEqual(["card-a", "card-b"]);
    expect(results.every((r) => r.grade === "good")).toBe(true);
    expect(revlogEntries).toHaveLength(2);

    // Both rows were actually written, with a future due and an extra rep.
    const rows = await db.select().from(flashcards);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.due_timestamp_ms).toBeGreaterThan(now.getTime());
      expect(row.reps).toBe(4);
      expect(row.last_review_timestamp_ms).not.toBeNull();
    }
  });

  test("reports missing card ids and still grades the found ones", async () => {
    await seedCard(raw, "card-a");

    const items = parseGradeInput({
      positional: ["card-a", "does-not-exist", "hard"],
      stdin: null,
    });

    const { results, missing } = await applyGrades({ db, items });

    expect(results.map((r) => r.id)).toEqual(["card-a"]);
    expect(missing).toEqual(["does-not-exist"]);
  });

  test("applies mixed grades from a stdin-style payload", async () => {
    await seedCard(raw, "card-a");
    await seedCard(raw, "card-b");

    const items = parseGradeInput({
      positional: [],
      stdin: JSON.stringify([
        { id: "card-a", grade: "again" },
        { id: "card-b", grade: "easy" },
      ]),
    });

    const { results } = await applyGrades({ db, items });

    const byId = Object.fromEntries(results.map((r) => [r.id, r.grade]));
    expect(byId).toEqual({ "card-a": "again", "card-b": "easy" });

    // "again" should schedule sooner than "easy".
    const [a] = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.id, "card-a"));
    const [b] = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.id, "card-b"));
    expect(a.due_timestamp_ms).toBeLessThan(b.due_timestamp_ms as number);
  });

  test("advances the streak exactly once for a batch", async () => {
    await seedCard(raw, "card-a");
    await seedCard(raw, "card-b");

    const items = parseGradeInput({
      positional: ["card-a", "card-b", "good"],
      stdin: null,
    });
    await applyGrades({ db, items });

    const stats = await db.select().from(userStats);
    expect(stats).toHaveLength(1);
    expect(stats[0].streak_count).toBe(1);
  });
});
