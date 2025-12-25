import {
  SelectFlashcard,
  FlashcardState,
} from "@bahar/drizzle-user-db-schemas";
import { intlFormatDistance } from "date-fns";
import { Card } from "ts-fsrs";

/**
 * Formats the interval between two dates into a relative time string.
 */
export const formatInterval = (due: Date, now: Date, locale: string) => {
  const DAYS_IN_MS = 1000 * 60 * 60 * 24;

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / DAYS_IN_MS);
  const dueOnSameDay = diffDays < 1;

  if (dueOnSameDay) {
    return intlFormatDistance(due, now, { style: "narrow", locale });
  }

  return intlFormatDistance(due, now, { style: "narrow", locale, unit: "day" });
};

/**
 * Converts the database represetnation of a flashcard to the format
 * expected by the fsrs library.
 */
export const convertFlashcardToFsrsCard = (
  flashcard: SelectFlashcard,
): Card & { id: string } => {
  return {
    ...flashcard,
    due: new Date(flashcard.due),
    stability: flashcard.stability ?? 0,
    difficulty: flashcard.difficulty ?? 0,
    elapsed_days: flashcard.elapsed_days ?? 0,
    scheduled_days: flashcard.scheduled_days ?? 0,
    reps: flashcard.reps ?? 0,
    lapses: flashcard.lapses ?? 0,
    state: flashcard.state ?? FlashcardState.NEW,
    learning_steps: flashcard.learning_steps ?? 0,
    last_review: flashcard.last_review
      ? new Date(flashcard.last_review)
      : undefined,
  };
};
