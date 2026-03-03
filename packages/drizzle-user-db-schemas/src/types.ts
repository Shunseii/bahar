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
  sentence: z.string().describe("Example sentence in Arabic with full tashkeel."),
  context: z
    .string()
    .optional()
    .describe("Register or setting, e.g. formal, colloquial, literary, Quranic, modern."),
  translation: z.string().optional().describe("English translation of the sentence."),
});
export type Example = z.infer<typeof ExampleSchema>;

export const IsmMorphologySchema = z.object({
  singular: z.string().optional().describe("Singular form with full tashkeel."),
  dual: z.string().optional().describe("Dual form (المثنى) with full tashkeel."),
  plurals: z
    .array(
      z.object({
        word: z.string(),
        details: z
          .string()
          .optional()
          .describe(
            "Optional context about the plural such as usage notes. Omit if straightforward."
          ),
      })
    )
    .optional(),
  gender: z.enum(["masculine", "feminine"]).optional(),
  inflection: z.enum(["indeclinable", "diptote", "triptote"]).optional(),
});

export const VerbMorphologySchema = z.object({
  huroof: z
    .array(
      z.object({
        harf: z.string(),
        meaning: z.string().optional(),
      })
    )
    .optional()
    .describe(
      "Prepositions (huroof al-jarr) that pair with this verb to alter its meaning, e.g. رَغِبَ في (to desire) vs رَغِبَ عن (to shun). Omit if no notable particle pairings."
    ),
  past_tense: z.string().optional().describe("Third-person masculine singular past (الماضي) with full tashkeel."),
  present_tense: z.string().optional().describe("Third-person masculine singular present (المضارع) with full tashkeel."),
  active_participle: z.string().optional().describe("Active participle (اسم الفاعل) with full tashkeel."),
  passive_participle: z.string().optional().describe("Passive participle (اسم المفعول) with full tashkeel."),
  imperative: z.string().optional().describe("Imperative (الأمر) with full tashkeel."),
  masadir: z
    .array(
      z.object({
        word: z.string(),
        details: z
          .string()
          .optional()
          .describe(
            "Optional usage notes, e.g. 'formal register' or 'more common than X'. Omit if straightforward."
          ),
      })
    )
    .optional(),
  form: z
    .string()
    .optional()
    .describe("Verb form in Roman numerals (I–XII)."),
  form_arabic: z
    .string()
    .optional()
    .describe(
      "The Arabic wazn (model pattern) for this verb form, e.g. فَعَلَ for Form I, أَفْعَلَ for Form IV, تَفَاعَلَ for Form VI."
    ),
});

export const MorphologySchema = z
  .object({
    ism: IsmMorphologySchema.optional(),
    verb: VerbMorphologySchema.optional(),
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
