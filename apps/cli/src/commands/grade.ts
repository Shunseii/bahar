import {
  flashcards,
  type SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { createScheduler, getSchedulingOptions } from "@bahar/fsrs";
import { defineCommand } from "@bunli/core";
import { eq } from "drizzle-orm";
import { type Grade, Rating } from "ts-fsrs";
import { loadCredentials } from "../lib/credentials";
import { connectUserDb } from "../lib/db";
import { postRevlog } from "../lib/revlog";
import { recordReview } from "../lib/streak";

const GRADE_BY_LABEL: Record<string, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const GRADE_LABELS = Object.keys(GRADE_BY_LABEL).join(" | ");

const printHelp = () => {
  console.log(`Grade a flashcard, running the real FSRS scheduler.

Usage:
  bahar grade <card-id> <grade>    Grade the card and persist: updates the
                                   flashcard, the streak, and the review log.
  bahar grade help                 Show this help.

  <grade>   one of: ${GRADE_LABELS}

Find a card's id by querying the user's database directly (see the
bahar-data-access skill). Never hand-write FSRS fields — always grade here.`);
};

/**
 * Builds the flashcard columns to persist from a scheduled FSRS card.
 * Matches the update the web/mobile apps write on a review.
 */
const toFlashcardUpdate = (
  card: ReturnType<typeof getSchedulingOptions>[Grade]["card"]
) => ({
  due: card.due.toISOString(),
  due_timestamp_ms: card.due.getTime(),
  last_review: card.last_review?.toISOString() ?? null,
  last_review_timestamp_ms: card.last_review?.getTime() ?? null,
  state: card.state,
  stability: card.stability,
  difficulty: card.difficulty,
  reps: card.reps,
  lapses: card.lapses,
  elapsed_days: card.elapsed_days,
  scheduled_days: card.scheduled_days,
  learning_steps: card.learning_steps,
});

export const gradeCommand = defineCommand({
  name: "grade",
  description: "Grade a flashcard (preview intervals, or grade and persist)",
  handler: async ({ positional, colors }) => {
    const [cardId, gradeArg] = positional as string[];

    if (!cardId || cardId === "help") {
      printHelp();
      return;
    }

    if (!gradeArg) {
      console.error(
        colors.red(`A grade is required. Use one of: ${GRADE_LABELS}.`)
      );
      process.exitCode = 1;
      return;
    }

    const grade = GRADE_BY_LABEL[gradeArg.toLowerCase()];
    if (grade === undefined) {
      console.error(
        colors.red(`Invalid grade "${gradeArg}". Use one of: ${GRADE_LABELS}.`)
      );
      process.exitCode = 1;
      return;
    }

    const credentials = await loadCredentials();
    if (!credentials) {
      console.error(colors.red("Not logged in. Run `bahar login` first."));
      process.exitCode = 1;
      return;
    }

    const { db, client } = await connectUserDb(credentials.token);

    try {
      const [card] = (await db
        .select()
        .from(flashcards)
        .where(eq(flashcards.id, cardId))
        .limit(1)) as SelectFlashcard[];

      if (!card) {
        console.error(colors.red(`No flashcard found with id "${cardId}".`));
        process.exitCode = 1;
        return;
      }

      const scheduler = createScheduler();
      const now = new Date();
      const { card: scheduled, log } = getSchedulingOptions(
        scheduler,
        card,
        now
      )[grade];
      const updates = toFlashcardUpdate(scheduled);

      await db.update(flashcards).set(updates).where(eq(flashcards.id, cardId));
      await recordReview(db);

      // Fire-and-forget like the app — a failed revlog must not fail the grade.
      await postRevlog({
        token: credentials.token,
        log,
        direction: card.direction,
        dictionaryEntryId: card.dictionary_entry_id,
      }).catch((err) => {
        console.warn(`Failed to post revlog: ${err}`);
      });

      console.log(
        JSON.stringify(
          { id: cardId, grade: gradeArg.toLowerCase(), ...updates },
          null,
          2
        )
      );
    } finally {
      client.close();
    }
  },
});
