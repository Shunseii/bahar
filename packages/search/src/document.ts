/**
 * Transform from a dictionary entry to the document shape Orama indexes.
 */

import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import type { DictionaryDocument } from "./schema";

/**
 * Builds the Orama document for a dictionary entry.
 *
 * `morphology.plurals` and `morphology.masadir` are stored as `{ word: string }[]`
 * in the database but indexed as `string[]`, and each searchable Arabic field
 * gets an `_exact` twin holding the un-normalized text so exact matches can
 * outrank fuzzy ones.
 *
 * `maxDifficulty` and `lastReviewTimestampMs` are derived from the flashcards
 * table rather than the entry itself, so they're passed in. When omitted they
 * are left off the document entirely -- an update that merges over the indexed
 * document then keeps whatever is already there instead of resetting the
 * difficulty and recently-reviewed sort positions.
 */
export const toOramaDocument = ({
  entry,
  maxDifficulty,
  lastReviewTimestampMs,
}: {
  entry: SelectDictionaryEntry;
  maxDifficulty?: number;
  lastReviewTimestampMs?: number;
}): DictionaryDocument => {
  const morphology = entry.morphology;

  return {
    id: entry.id,
    word: entry.word,
    word_exact: entry.word,
    translation: entry.translation,
    created_at: entry.created_at ?? undefined,
    created_at_timestamp_ms: entry.created_at_timestamp_ms ?? undefined,
    updated_at: entry.updated_at ?? undefined,
    updated_at_timestamp_ms: entry.updated_at_timestamp_ms ?? undefined,
    definition: entry.definition ?? undefined,
    type: entry.type ?? undefined,
    root: entry.root ?? undefined,
    tags: entry.tags ?? undefined,
    antonyms: entry.antonyms ?? undefined,
    examples: entry.examples ?? undefined,
    morphology: morphology
      ? {
          ism: morphology.ism
            ? {
                singular: morphology.ism.singular,
                plurals: morphology.ism.plurals?.map((p) => p.word),
                singular_exact: morphology.ism.singular,
                plurals_exact: morphology.ism.plurals?.map((p) => p.word),
              }
            : undefined,
          verb: morphology.verb
            ? {
                past_tense: morphology.verb.past_tense,
                present_tense: morphology.verb.present_tense,
                masadir: morphology.verb.masadir?.map((m) => m.word),
                past_tense_exact: morphology.verb.past_tense,
                present_tense_exact: morphology.verb.present_tense,
                masadir_exact: morphology.verb.masadir?.map((m) => m.word),
              }
            : undefined,
        }
      : undefined,
    ...(maxDifficulty === undefined ? {} : { max_difficulty: maxDifficulty }),
    ...(lastReviewTimestampMs === undefined
      ? {}
      : { last_review_timestamp_ms: lastReviewTimestampMs }),
  };
};
