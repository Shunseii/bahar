import {
  flashcards,
  type SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { createScheduler } from "@bahar/fsrs";
import { eq, inArray } from "drizzle-orm";
import type { UserDb } from "./db";
import { scheduleGrade } from "./grade";
import type { GradeItem } from "./grade-input";
import { recordReview } from "./streak";
import type { RevlogInput } from "./revlog";

export type GradeResult = { id: string; grade: string; due: string };

export type ApplyGradesResult = {
  results: GradeResult[];
  missing: string[];
  revlogEntries: RevlogInput[];
};

/**
 * Grades every item against the database in one pass: fetches all target cards
 * in a single query, runs the FSRS scheduler per card, persists all flashcard
 * updates in one atomic batch, and advances the streak once.
 *
 * Ids with no matching flashcard are returned in `missing` and skipped. Review
 * logs are returned (not posted) so the caller owns the network call.
 */
export const applyGrades = async ({
  db,
  items,
  now = new Date(),
}: {
  db: UserDb;
  items: GradeItem[];
  now?: Date;
}): Promise<ApplyGradesResult> => {
  const ids = items.map((item) => item.id);
  const cards = (await db
    .select()
    .from(flashcards)
    .where(inArray(flashcards.id, ids))) as SelectFlashcard[];

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const missing = ids.filter((id) => !cardById.has(id));

  const scheduler = createScheduler();
  const updateStatements = [];
  const revlogEntries: RevlogInput[] = [];
  const results: GradeResult[] = [];

  for (const { id, gradeLabel, grade } of items) {
    const card = cardById.get(id);
    if (!card) continue;

    const { updates, log } = scheduleGrade({ scheduler, card, grade, now });

    updateStatements.push(
      db.update(flashcards).set(updates).where(eq(flashcards.id, id))
    );
    revlogEntries.push({
      log,
      direction: card.direction,
      dictionaryEntryId: card.dictionary_entry_id,
    });
    results.push({ id, grade: gradeLabel, due: updates.due });
  }

  if (updateStatements.length > 0) {
    // One atomic round-trip for every flashcard update.
    await db.batch(
      updateStatements as [
        (typeof updateStatements)[number],
        ...(typeof updateStatements)[number][],
      ]
    );
    await recordReview(db);
  }

  return { results, missing, revlogEntries };
};
