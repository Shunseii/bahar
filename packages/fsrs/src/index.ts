/**
 * @bahar/fsrs - Shared FSRS utilities for flashcard spaced repetition
 *
 * Provides utilities for the FSRS (Free Spaced Repetition Scheduler) algorithm
 * used across web and mobile apps.
 */

import {
  Card,
  createEmptyCard,
  fsrs,
  Grade,
  Rating,
  RecordLog,
  RecordLogItem,
  State,
  type FSRS,
  type FSRSParameters,
} from "ts-fsrs";
import {
  type FlashcardDirection,
  FlashcardState,
  type SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";

export { createEmptyCard, fsrs, Rating, State };

export type { Card, FSRS, FSRSParameters, Grade, RecordLog, RecordLogItem };

/**
 * Converts a database flashcard to an FSRS Card with Date objects
 */
export const toFsrsCard = (
  flashcard: SelectFlashcard,
): Card & { id: string } => {
  return {
    id: flashcard.id,
    due: new Date(flashcard.due),
    stability: flashcard.stability ?? 0,
    difficulty: flashcard.difficulty ?? 0,
    elapsed_days: flashcard.elapsed_days ?? 0,
    scheduled_days: flashcard.scheduled_days ?? 0,
    reps: flashcard.reps ?? 0,
    lapses: flashcard.lapses ?? 0,
    state: (flashcard.state ?? FlashcardState.NEW) as State,
    last_review: flashcard.last_review
      ? new Date(flashcard.last_review)
      : undefined,
  };
};

/**
 * Converts an FSRS Card back to database format
 */
export const fromFsrsCard = (
  card: Card,
  dictionaryEntryId: string,
  direction: FlashcardDirection,
): Omit<SelectFlashcard, "id" | "is_hidden"> => {
  const dueTimestampMs = card.due.getTime();
  const lastReviewTimestampMs = card.last_review?.getTime() ?? null;

  return {
    dictionary_entry_id: dictionaryEntryId,
    difficulty: card.difficulty,
    due: card.due.toISOString(),
    due_timestamp_ms: dueTimestampMs,
    elapsed_days: card.elapsed_days,
    lapses: card.lapses,
    last_review: card.last_review?.toISOString() ?? null,
    last_review_timestamp_ms: lastReviewTimestampMs,
    reps: card.reps,
    scheduled_days: card.scheduled_days,
    stability: card.stability,
    state: card.state,
    direction,
  };
};

/**
 * Creates a new empty flashcard for a dictionary entry
 */
export const createNewFlashcard = (
  dictionaryEntryId: string,
  direction: FlashcardDirection,
): Omit<SelectFlashcard, "id" | "is_hidden"> => {
  const emptyCard = createEmptyCard();
  return fromFsrsCard(emptyCard, dictionaryEntryId, direction);
};

/**
 * Creates an FSRS scheduler instance with fuzzing enabled
 */
export const createScheduler = (params?: Partial<FSRSParameters>): FSRS => {
  return fsrs({
    enable_fuzz: true,
    ...params,
  });
};

/**
 * Gets the scheduling options for a card at the current time
 */
export const getSchedulingOptions = (
  scheduler: FSRS,
  flashcard: SelectFlashcard,
  now: Date = new Date(),
): RecordLog => {
  const fsrsCard = toFsrsCard(flashcard);
  return scheduler.repeat(fsrsCard, now);
};

/**
 * Grades a flashcard and returns the updated database fields
 */
export const gradeFlashcard = (
  scheduler: FSRS,
  flashcard: SelectFlashcard,
  grade: Grade,
  now: Date = new Date(),
): Pick<
  SelectFlashcard,
  | "due"
  | "due_timestamp_ms"
  | "last_review"
  | "last_review_timestamp_ms"
  | "state"
  | "stability"
  | "difficulty"
  | "reps"
  | "lapses"
  | "elapsed_days"
  | "scheduled_days"
> => {
  const fsrsCard = toFsrsCard(flashcard);
  const scheduling = scheduler.repeat(fsrsCard, now);
  const selectedCard = scheduling[grade].card;

  const dueTimestampMs = selectedCard.due.getTime();
  const lastReviewTimestampMs = selectedCard.last_review?.getTime() ?? null;

  return {
    due: selectedCard.due.toISOString(),
    due_timestamp_ms: dueTimestampMs,
    last_review: selectedCard.last_review?.toISOString() ?? null,
    last_review_timestamp_ms: lastReviewTimestampMs,
    state: selectedCard.state,
    stability: selectedCard.stability,
    difficulty: selectedCard.difficulty,
    reps: selectedCard.reps,
    lapses: selectedCard.lapses,
    elapsed_days: selectedCard.elapsed_days,
    scheduled_days: selectedCard.scheduled_days,
  };
};
