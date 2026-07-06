import { beforeEach, describe, expect, test } from "bun:test";
import * as schema from "@bahar/drizzle-user-db-schemas";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { UserDb } from "./db";
import { recordReview } from "./streak";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// In-memory user DB per test.
let client: Client;
let db: UserDb;

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  db = drizzle(client, { schema });

  await client.execute(
    `CREATE TABLE user_stats (
      id text PRIMARY KEY NOT NULL,
      streak_count integer DEFAULT 0,
      longest_streak integer DEFAULT 0,
      last_review_date text,
      timezone text
    )`
  );
  // TODO: also CREATE TABLE flashcards (columns per schema) for the gap tests.
});

// Helper: seed a user_stats row with a given last_review_date / streak.
// Helper: insert flashcards with specific due_timestamp_ms / is_hidden.
// Note: recordReview reads the system clock + timezone, so seed
// last_review_date relative to the real today/yesterday.

describe("recordReview", () => {
  test("no user_stats row -> inserts streak=1 for today", async () => {
    await recordReview(db);

    const { rows } = await client.execute("SELECT * FROM user_stats");
    expect(rows).toHaveLength(1);
    expect(rows[0].streak_count).toBe(1);
    expect(rows[0].longest_streak).toBe(1);
    expect(rows[0].last_review_date).toMatch(ISO_DATE_RE);
  });

  test("already reviewed today -> no-op (streak unchanged)", async () => {
    // Given: last_review_date === today, streak_count=5
    // When:  recordReview(db)
    // Then:  streak_count still 5, last_review_date still today
  });

  test("last review was yesterday -> streak increments", async () => {
    // Given: last_review_date === yesterday, streak_count=5
    // When:  recordReview(db)
    // Then:  streak_count=6, last_review_date=today, longest_streak>=6
  });

  test("gap with no due cards missed -> streak forgiven (increments)", async () => {
    // Given: last_review_date = 3 days ago, streak_count=5,
    //        NO flashcards came due during the gap
    // When:  recordReview(db)
    // Then:  streak_count=6 (forgiven, not reset)
  });

  test("gap with due cards missed -> streak resets to 1", async () => {
    // Given: last_review_date = 3 days ago, streak_count=5,
    //        a flashcard was due (and not hidden) during the gap
    // When:  recordReview(db)
    // Then:  streak_count=1
  });

  test("hidden due cards in the gap do not break the streak", async () => {
    // Given: the only card due in the gap has is_hidden=true
    // When:  recordReview(db)
    // Then:  streak forgiven (increments), not reset
  });

  test("longest_streak only grows, never shrinks", async () => {
    // Given: longest_streak=10, current streak resets to 1
    // When:  recordReview(db)
    // Then:  longest_streak still 10
  });
});
