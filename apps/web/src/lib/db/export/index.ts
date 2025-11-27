import {
  SelectFlashcard,
  RawDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { convertRawDictionaryEntryToSelectDictionaryEntry } from "../utils";
import { ImportWordV1 } from "../import/v1/schema";

/**
 * Transforms a dictionary entry with its flashcards into export format.
 * Always exports in the latest format.
 */
export function transformForExport({
  entry,
  flashcards,
  includeFlashcards,
}: {
  entry: RawDictionaryEntry;
  flashcards: SelectFlashcard[];
  includeFlashcards: boolean;
}): ImportWordV1 {
  const converted = convertRawDictionaryEntryToSelectDictionaryEntry(entry);

  const result: ImportWordV1 = {
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
