import { beforeEach, describe, expect, test } from "bun:test";
import { dictionaryEntries, flashcards } from "@bahar/drizzle-user-db-schemas";
import { eq } from "drizzle-orm";
import { applyAdds } from "./apply-adds";
import type { UserDb } from "./db";
import { buildTestDb } from "./test-db";
import { parseWordInput } from "./word-input";

describe("applyAdds", () => {
  let db: UserDb;

  beforeEach(async () => {
    ({ db } = await buildTestDb());
  });

  test("adds a word with a forward + reverse flashcard pair", async () => {
    const items = parseWordInput(
      JSON.stringify([
        { word: "نور", translation: "light", type: "ism", tags: ["nature"] },
      ])
    );

    const { added } = await applyAdds({ db, items });

    expect(added).toHaveLength(1);
    const [entryId] = added.map((a) => a.id);

    const entries = await db.select().from(dictionaryEntries);
    expect(entries).toHaveLength(1);
    expect(entries[0].word).toBe("نور");
    expect(entries[0].tags).toEqual(["nature"]);
    expect(entries[0].updated_at_timestamp_ms).not.toBeNull();

    const cards = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.dictionary_entry_id, entryId));
    expect(cards.map((c) => c.direction).sort()).toEqual([
      "forward",
      "reverse",
    ]);
    // Fresh FSRS state.
    for (const card of cards) {
      expect(card.state).toBe(0);
      expect(card.reps).toBe(0);
      expect(card.is_hidden).toBe(false);
    }
  });

  test("adds multiple words, each with its own pair", async () => {
    // Parse a JSON array of 3 words, call applyAdds.
    // Assert 3 entries and 6 flashcards total, ids all distinct.
  });

  test("persists JSON columns (root, examples) as parsed values", async () => {
    // Parse a word that includes root and examples.
    // Call applyAdds, read the entry back through drizzle (json mode).
    // Assert the arrays/objects round-trip equal to the input (not double-encoded).
  });

  test("leaves no orphaned entry when a flashcard insert fails", async () => {
    // Force a flashcard insert to violate (entry_id, direction) uniqueness mid-batch.
    // Expect applyAdds to reject.
    // Assert the entry for that word was NOT written either (per-word batch is atomic).
  });
});
