/**
 * Utilities for importing and exporting dictionary data.
 * Handles transformations between JSON format and local database format.
 */

import { nanoid } from "nanoid";
import { createEmptyCard } from "ts-fsrs";
import {
  SelectFlashcard,
  RawDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { convertRawDictionaryEntryToSelectDictionaryEntry } from "../../utils";
import { ExportSchemaWithFlashcardsV1 } from "./schema";
import { z } from "zod";
import { toMs } from "@/lib/utils";

type ImportWord = z.infer<typeof ExportSchemaWithFlashcardsV1>[number];

interface SqlStatement {
  sql: string;
  args: unknown[];
}

/**
 * Creates SQL statements for inserting a dictionary entry and its flashcards
 */
export function createImportStatements(word: ImportWord): {
  dictEntry: SqlStatement;
  flashcards: [SqlStatement, SqlStatement];
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
      word.type ?? null,
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

  const flashcards: [SqlStatement, SqlStatement] = [
    createFlashcardStatement({
      dictionaryEntryId: word.id,
      direction: "forward",
      flashcardData: word.flashcard,
    }),
    createFlashcardStatement({
      dictionaryEntryId: word.id,
      direction: "reverse",
      flashcardData: word.flashcard_reverse,
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
  flashcardData?: ImportWord["flashcard"];
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
      lapses, last_review, last_review_timestamp_ms, reps, scheduled_days, stability, state, direction, is_hidden
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      state = excluded.state`,
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
      direction,
      0, // is_hidden
    ],
  };
}

/**
 * Transforms a dictionary entry with its flashcards into export format
 */
export function transformForExport({
  entry,
  flashcards,
  includeFlashcards,
}: {
  entry: RawDictionaryEntry;
  flashcards: SelectFlashcard[];
  includeFlashcards: boolean;
}): ImportWord {
  const converted = convertRawDictionaryEntryToSelectDictionaryEntry(entry);

  const result: ImportWord = {
    id: converted.id,
    word: converted.word,
    translation: converted.translation,
    definition: converted.definition ?? undefined,
    type: converted.type ?? undefined,
    root: converted.root ?? undefined,
    tags: converted.tags ?? undefined,
    antonyms: converted.antonyms ?? undefined,
    examples: converted.examples ?? undefined,
    morphology: converted.morphology ?? undefined,
  };

  if (includeFlashcards) {
    result.created_at = converted.created_at ?? undefined;
    result.created_at_timestamp = converted.created_at_timestamp_ms
      ? Math.floor(converted.created_at_timestamp_ms / 1000)
      : undefined;
    result.updated_at = converted.updated_at ?? undefined;
    result.updated_at_timestamp = converted.updated_at_timestamp_ms
      ? Math.floor(converted.updated_at_timestamp_ms / 1000)
      : undefined;

    for (const fc of flashcards) {
      const flashcardObj = {
        difficulty: fc.difficulty ?? 0,
        due: fc.due,
        due_timestamp: Math.floor(fc.due_timestamp_ms / 1000),
        elapsed_days: fc.elapsed_days ?? 0,
        lapses: fc.lapses ?? 0,
        last_review: fc.last_review ?? null,
        last_review_timestamp: fc.last_review_timestamp_ms
          ? Math.floor(fc.last_review_timestamp_ms / 1000)
          : null,
        reps: fc.reps ?? 0,
        scheduled_days: fc.scheduled_days ?? 0,
        stability: fc.stability ?? 0,
        state: (fc.state ?? 0) as 0 | 1 | 2 | 3,
      };

      if (fc.direction === "forward") {
        result.flashcard = flashcardObj;
      } else {
        result.flashcard_reverse = flashcardObj;
      }
    }
  }

  return result;
}

/**
 * Reads a file as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Batches an array into chunks of specified size
 */
export function* batchArray<T>(array: T[], batchSize: number) {
  for (let i = 0; i < array.length; i += batchSize) {
    yield array.slice(i, i + batchSize);
  }
}
