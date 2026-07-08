import type { SelectFlashcard } from "@bahar/drizzle-user-db-schemas";
import { type createScheduler, getSchedulingOptions } from "@bahar/fsrs";
import { type Grade, Rating, type ReviewLog } from "ts-fsrs";

export const GRADE_BY_LABEL: Record<string, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export const GRADE_LABELS = Object.keys(GRADE_BY_LABEL).join(" | ");

/** Resolves a user-supplied grade label to an FSRS grade, or `undefined`. */
export const parseGradeLabel = (raw: string): Grade | undefined =>
  GRADE_BY_LABEL[raw.toLowerCase()];

/**
 * Flashcard columns persisted on a review. Matches the update the web/mobile
 * apps write, so a CLI grade is indistinguishable from an in-app one.
 */
export const toFlashcardUpdate = (
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

export type FlashcardUpdate = ReturnType<typeof toFlashcardUpdate>;

/**
 * Runs the FSRS scheduler for a single card + grade, returning both the columns
 * to persist and the review log to record.
 */
export const scheduleGrade = ({
  scheduler,
  card,
  grade,
  now,
}: {
  scheduler: ReturnType<typeof createScheduler>;
  card: SelectFlashcard;
  grade: Grade;
  now: Date;
}): { updates: FlashcardUpdate; log: ReviewLog } => {
  const { card: scheduled, log } = getSchedulingOptions(scheduler, card, now)[
    grade
  ];
  return { updates: toFlashcardUpdate(scheduled), log };
};
