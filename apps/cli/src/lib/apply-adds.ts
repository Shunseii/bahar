import {
  dictionaryEntries,
  flashcards,
  type InsertFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { createNewFlashcard } from "@bahar/fsrs";
import { nanoid } from "nanoid/non-secure";
import type { UserDb } from "./db";
import type { WordInput } from "./word-input";

export type AddResult = {
  id: string;
  word: string;
  flashcardIds: { forward: string; reverse: string };
};

export type ApplyAddsResult = {
  added: AddResult[];
};

const buildFlashcard = (
  dictionaryEntryId: string,
  direction: "forward" | "reverse"
): InsertFlashcard => ({
  id: nanoid(),
  is_hidden: false,
  ...createNewFlashcard(dictionaryEntryId, direction),
});

/**
 * Adds each word together with its forward + reverse flashcard pair. Each word
 * is written in its own atomic `db.batch` (entry insert + both flashcard
 * inserts), so a failure can never leave an entry without its cards -- the
 * orphaned-entry state that hand-rolled SQL inserts produced. Field mapping and
 * flashcard creation mirror the app's canonical mutations (addWord +
 * createFlashcardPair in @bahar/db-operations).
 */
export const applyAdds = async ({
  db,
  items,
  now = new Date(),
}: {
  db: UserDb;
  items: WordInput[];
  now?: Date;
}): Promise<ApplyAddsResult> => {
  const added: AddResult[] = [];

  for (const item of items) {
    const id = nanoid();
    const forward = buildFlashcard(id, "forward");
    const reverse = buildFlashcard(id, "reverse");

    await db.batch([
      db.insert(dictionaryEntries).values({
        id,
        word: item.word,
        translation: item.translation,
        type: item.type,
        definition: item.definition ?? null,
        root: item.root ?? null,
        tags: item.tags ?? null,
        antonyms: item.antonyms ?? null,
        examples: item.examples ?? null,
        morphology: item.morphology ?? null,
        created_at: now.toISOString(),
        created_at_timestamp_ms: now.getTime(),
        updated_at: now.toISOString(),
        updated_at_timestamp_ms: now.getTime(),
      }),
      db.insert(flashcards).values(forward),
      db.insert(flashcards).values(reverse),
    ]);

    added.push({
      id,
      word: item.word,
      flashcardIds: { forward: forward.id, reverse: reverse.id },
    });
  }

  return { added };
};
