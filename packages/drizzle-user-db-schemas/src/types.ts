/**
 * @file Zod schemas and TypeScript types for JSON fields in user database tables.
 * Types are inferred from schemas to ensure runtime and compile-time consistency.
 */
import { z } from "zod";

// Dictionary schemas and types
export const WORD_TYPES = ["ism", "fi'l", "harf", "expression"] as const;

export const WordTypeSchema = z.enum(WORD_TYPES);
export type WordType = z.infer<typeof WordTypeSchema>;

export const RootLettersSchema = z.array(z.string());
export type RootLetters = z.infer<typeof RootLettersSchema>;

export const TagsSchema = z.array(z.string());
export type Tags = z.infer<typeof TagsSchema>;

export const AntonymSchema = z.object({
  word: z.string().optional(),
});
export type Antonym = z.infer<typeof AntonymSchema>;

export const ExampleSchema = z.object({
  sentence: z.string(),
  context: z.string().optional(),
  translation: z.string().optional(),
});
export type Example = z.infer<typeof ExampleSchema>;

export const MorphologySchema: z.ZodSchema<any> = z
  .object({
    ism: z
      .object({
        singular: z.string().optional(),
        dual: z.string().optional(),
        plurals: z
          .array(
            z.object({
              word: z.string(),
              details: z.string().optional(),
            }),
          )
          .optional(),
        gender: z.enum(["masculine", "feminine"]).optional(),
        inflection: z
          .enum(["indeclinable", "diptote", "triptote"])
          .optional(),
      })
      .optional(),
    verb: z
      .object({
        huroof: z
          .array(
            z.object({
              harf: z.string(),
              meaning: z.string().optional(),
            }),
          )
          .optional(),
        past_tense: z.string().optional(),
        present_tense: z.string().optional(),
        active_participle: z.string().optional(),
        passive_participle: z.string().optional(),
        imperative: z.string().optional(),
        masadir: z
          .array(
            z.object({
              word: z.string(),
              details: z.string().optional(),
            }),
          )
          .optional(),
        form: z.string().optional(),
        form_arabic: z.string().optional(),
      })
      .optional(),
  })
  .optional();

export type Morphology = z.infer<typeof MorphologySchema>;

// Flashcard types
export const FLASHCARD_DIRECTIONS = ["forward", "reverse"] as const;

export type FlashcardDirection = (typeof FLASHCARD_DIRECTIONS)[number];

export enum FlashcardState {
  NEW = 0,
  LEARNING = 1,
  REVIEW = 2,
  RE_LEARNING = 3,
}

// Deck types
export type DeckFilters = {
  tags?: string[];
  state?: FlashcardState[];
  types?: WordType[];
};

// Settings types
export const ANTONYMS_MODES = ["hidden", "answer", "hint"] as const;

export type ShowAntonymsMode = (typeof ANTONYMS_MODES)[number];

// Migrations types
export const MIGRATION_STATUSES = ["applied", "pending", "failed"] as const;

export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];
