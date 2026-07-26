import { nanoid } from "nanoid";
import { createEmptyCard } from "ts-fsrs";
import { toMs } from "@/lib/utils";
import type { ImportWordV1 } from "./schema";

interface SqlStatement {
  sql: string;
  args: unknown[];
}

/**
 * Creates SQL statements for inserting a dictionary entry and its flashcards.
 *
 * The file governs scheduling state, not which cards exist. Forward is always
 * upserted. Reverse is only created when the entry says it should have one:
 * - the entry carries reverse flashcard data -> upsert it with that state
 * - the entry carries forward-only flashcard data -> reverse was off, so do not
 *   create one
 * - the entry carries no flashcard data at all (export without flashcards)
 *   -> fall back to `createReverseByDefault`, matching a fresh word add
 *
 * When no reverse card is to be created, an existing one is still reset, so an
 * import does not leave one card's progress wiped and its pair's intact.
 * Resetting rather than deleting keeps reverse switched on for words that have
 * it -- which card exists stays the user's choice.
 */
export function createImportStatements({
  word,
  createReverseByDefault = false,
}: {
  word: ImportWordV1;
  createReverseByDefault?: boolean;
}): {
  dictEntry: SqlStatement;
  flashcards: SqlStatement[];
} {
  const now = new Date();

  const createdAtTimestampMs = word.created_at_timestamp
    ? toMs(word.created_at_timestamp)
    : now.getTime();

  const updatedAtTimestampMs = word.updated_at_timestamp
    ? toMs(word.updated_at_timestamp)
    : now.getTime();

  const dictEntry: SqlStatement = {
    sql: `INSERT INTO dictionary_entries (
      id, word, translation, definition, type, root, tags, antonyms, examples, morphology,
      created_at, created_at_timestamp_ms, updated_at, updated_at_timestamp_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      word = excluded.word,
      translation = excluded.translation,
      definition = excluded.definition,
      type = excluded.type,
      root = excluded.root,
      tags = excluded.tags,
      antonyms = excluded.antonyms,
      examples = excluded.examples,
      morphology = excluded.morphology,
      updated_at = excluded.updated_at,
      updated_at_timestamp_ms = excluded.updated_at_timestamp_ms`,
    args: [
      word.id,
      word.word,
      word.translation,
      word.definition ?? null,
      word.type,
      word.root ? JSON.stringify(word.root) : null,
      word.tags ? JSON.stringify(word.tags) : null,
      word.antonyms ? JSON.stringify(word.antonyms) : null,
      word.examples ? JSON.stringify(word.examples) : null,
      word.morphology ? JSON.stringify(word.morphology) : null,
      word.created_at ?? now.toISOString(),
      createdAtTimestampMs,
      word.updated_at ?? now.toISOString(),
      updatedAtTimestampMs,
    ],
  };

  const hasFlashcardData = Boolean(word.flashcard || word.flashcard_reverse);
  const shouldCreateReverse = hasFlashcardData
    ? Boolean(word.flashcard_reverse)
    : createReverseByDefault;

  const flashcards: SqlStatement[] = [
    createFlashcardStatement({
      dictionaryEntryId: word.id,
      direction: "forward",
      flashcardData: word.flashcard,
    }),
    shouldCreateReverse
      ? createFlashcardStatement({
          dictionaryEntryId: word.id,
          direction: "reverse",
          flashcardData: word.flashcard_reverse,
        })
      : createFlashcardResetStatement({
          dictionaryEntryId: word.id,
          direction: "reverse",
        }),
  ];

  return { dictEntry, flashcards };
}

/**
 * Creates a SQL statement for inserting a flashcard
 */
function createFlashcardStatement({
  dictionaryEntryId,
  direction,
  flashcardData,
}: {
  dictionaryEntryId: string;
  direction: "forward" | "reverse";
  flashcardData?: ImportWordV1["flashcard"];
}): SqlStatement {
  const emptyCard = createEmptyCard(new Date());

  const dueMs = flashcardData?.due_timestamp
    ? toMs(flashcardData.due_timestamp)
    : new Date(emptyCard.due).getTime();

  const lastReviewMs = flashcardData?.last_review_timestamp
    ? toMs(flashcardData.last_review_timestamp)
    : null;

  return {
    sql: `INSERT INTO flashcards (
      id, dictionary_entry_id, difficulty, due, due_timestamp_ms, elapsed_days,
      lapses, last_review, last_review_timestamp_ms, reps, scheduled_days, stability, state,
      learning_steps, direction, is_hidden
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dictionary_entry_id, direction) DO UPDATE SET
      difficulty = excluded.difficulty,
      due = excluded.due,
      due_timestamp_ms = excluded.due_timestamp_ms,
      elapsed_days = excluded.elapsed_days,
      lapses = excluded.lapses,
      last_review = excluded.last_review,
      last_review_timestamp_ms = excluded.last_review_timestamp_ms,
      reps = excluded.reps,
      scheduled_days = excluded.scheduled_days,
      stability = excluded.stability,
      state = excluded.state,
      learning_steps = excluded.learning_steps`,
    args: [
      nanoid(),
      dictionaryEntryId,
      flashcardData?.difficulty ?? emptyCard.difficulty,
      flashcardData?.due ?? emptyCard.due.toISOString(),
      dueMs,
      flashcardData?.elapsed_days ?? emptyCard.elapsed_days,
      flashcardData?.lapses ?? emptyCard.lapses,
      flashcardData?.last_review ?? null,
      lastReviewMs,
      flashcardData?.reps ?? emptyCard.reps,
      flashcardData?.scheduled_days ?? emptyCard.scheduled_days,
      flashcardData?.stability ?? emptyCard.stability,
      flashcardData?.state ?? emptyCard.state,
      flashcardData?.learning_steps ?? emptyCard.learning_steps,
      direction,
      0, // is_hidden
    ],
  };
}

/**
 * Creates a statement that resets a card's scheduling state without creating
 * one. An UPDATE rather than an upsert precisely because the row must stay
 * absent when it is absent: the file decides scheduling, the user decides which
 * cards exist.
 */
function createFlashcardResetStatement({
  dictionaryEntryId,
  direction,
}: {
  dictionaryEntryId: string;
  direction: "forward" | "reverse";
}): SqlStatement {
  const emptyCard = createEmptyCard(new Date());

  return {
    sql: `UPDATE flashcards SET
      difficulty = ?,
      due = ?,
      due_timestamp_ms = ?,
      elapsed_days = ?,
      lapses = ?,
      last_review = NULL,
      last_review_timestamp_ms = NULL,
      reps = ?,
      scheduled_days = ?,
      stability = ?,
      state = ?,
      learning_steps = ?
    WHERE dictionary_entry_id = ? AND direction = ?`,
    args: [
      emptyCard.difficulty,
      emptyCard.due.toISOString(),
      new Date(emptyCard.due).getTime(),
      emptyCard.elapsed_days,
      emptyCard.lapses,
      emptyCard.reps,
      emptyCard.scheduled_days,
      emptyCard.stability,
      emptyCard.state,
      emptyCard.learning_steps,
      dictionaryEntryId,
      direction,
    ],
  };
}
