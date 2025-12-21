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

// Re-export ts-fsrs functions and enums
export { createEmptyCard, fsrs, Rating, State };

// Re-export ts-fsrs types
export type { Card, FSRS, FSRSParameters, Grade, RecordLog, RecordLogItem };

/**
 * FlashcardState enum matching database schema
 */
export enum FlashcardState {
  NEW = 0,
  LEARNING = 1,
  REVIEW = 2,
  RE_LEARNING = 3,
}

/**
 * Flashcard direction type
 */
export type FlashcardDirection = "forward" | "reverse";

/**
 * Database flashcard representation (with string dates and nullable fields)
 */
export interface DatabaseFlashcard {
  id: string;
  dictionary_entry_id: string;
  difficulty: number | null;
  due: string;
  due_timestamp_ms: number;
  elapsed_days: number | null;
  lapses: number | null;
  last_review: string | null;
  last_review_timestamp_ms: number | null;
  reps: number | null;
  scheduled_days: number | null;
  stability: number | null;
  state: number | null;
  direction: FlashcardDirection;
  is_hidden: boolean;
}

/**
 * Converts a database flashcard to an FSRS Card with Date objects
 */
export const toFsrsCard = (
  flashcard: DatabaseFlashcard,
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
): Omit<DatabaseFlashcard, "id" | "is_hidden"> => {
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
): Omit<DatabaseFlashcard, "id" | "is_hidden"> => {
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
  flashcard: DatabaseFlashcard,
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
  flashcard: DatabaseFlashcard,
  grade: Grade,
  now: Date = new Date(),
): Pick<
  DatabaseFlashcard,
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

/**
 * Returns a human-readable interval description for a grade option
 */
export const getGradeInterval = (
  scheduling: RecordLog,
  grade: Grade,
): { days: number; card: Card } => {
  const item = scheduling[grade];
  return {
    days: item.card.scheduled_days,
    card: item.card,
  };
};
