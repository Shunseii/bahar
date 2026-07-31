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
  sentence: z
    .string()
    .describe("Example sentence in Arabic with full tashkeel."),
  context: z
    .string()
    .optional()
    .describe(
      "Leave empty unless the register is non-obvious (e.g. colloquial, Quranic, archaic). Omit for standard modern Arabic. This is NOT a translation."
    ),
  translation: z
    .string()
    .optional()
    .describe("English translation of the sentence."),
});
export type Example = z.infer<typeof ExampleSchema>;

export const IsmMorphologySchema = z.object({
  singular: z.string().optional().describe("Singular form with full tashkeel."),
  dual: z
    .string()
    .optional()
    .describe("Dual form (المثنى) with full tashkeel."),
  plurals: z
    .array(
      z.object({
        word: z.string(),
        details: z
          .string()
          .optional()
          .describe(
            "Leave empty for standard plurals. Only fill for genuinely non-obvious info (e.g. archaic, dialect-specific). Do NOT mention other plural forms here."
          ),
      })
    )
    .optional()
    .describe(
      "Only well-known, attested plural forms. Do NOT invent or guess broken plurals. Omit entirely if unsure."
    ),
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
  past_tense: z
    .string()
    .optional()
    .describe(
      "Third-person masculine singular past (الماضي) with full tashkeel."
    ),
  present_tense: z
    .string()
    .optional()
    .describe(
      "Third-person masculine singular present (المضارع) with full tashkeel."
    ),
  active_participle: z
    .string()
    .optional()
    .describe("Active participle (اسم الفاعل) with full tashkeel."),
  passive_participle: z
    .string()
    .optional()
    .describe("Passive participle (اسم المفعول) with full tashkeel."),
  imperative: z
    .string()
    .optional()
    .describe("Imperative (الأمر) with full tashkeel."),
  masadir: z
    .array(
      z.object({
        word: z.string(),
        details: z
          .string()
          .optional()
          .describe(
            "Leave empty for standard masadir. Only fill for genuinely non-obvious info (e.g. archaic, dialect-specific). Do NOT compare to other masadir forms."
          ),
      })
    )
    .optional(),
  form: z.string().optional().describe("Verb form in Roman numerals (I–XII)."),
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
export const TAG_MODES = ["all", "any"] as const;

export type TagMode = (typeof TAG_MODES)[number];

export type DeckFilters = {
  tags?: string[];
  /**
   * How multiple tags combine. `"all"` requires every tag, `"any"` requires at
   * least one.
   *
   * Absent means "keep what this surface already did", which differs by
   * surface: deck and flashcard queries have always been `"any"`, while the
   * dictionary search on the home screen has always been `"all"`. Resolve it
   * against the caller's own default rather than assuming one here.
   */
  tagMode?: TagMode;
  state?: FlashcardState[];
  types?: WordType[];
};

// Settings types
export const ANTONYMS_MODES = ["hidden", "answer", "hint"] as const;

export type ShowAntonymsMode = (typeof ANTONYMS_MODES)[number];

// Migrations types
export const MIGRATION_STATUSES = ["applied", "pending", "failed"] as const;

export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];

/**
 * A dictionary entry as accepted from outside the app: the CLI's `add` payload
 * and the API's create-entry body validate against this, so a word one accepts
 * is a word the other accepts. Built from the field schemas above, so it stays
 * in step with what the columns actually hold. Server-managed fields (id,
 * timestamps) and flashcards aren't part of the input.
 */
export const WordInputSchema = z.object({
  word: z.string().min(1),
  translation: z.string().min(1),
  type: WordTypeSchema,
  definition: z.string().nullish(),
  root: RootLettersSchema.nullish(),
  tags: TagsSchema.nullish(),
  antonyms: z.array(AntonymSchema).nullish(),
  examples: z.array(ExampleSchema).nullish(),
  morphology: MorphologySchema.nullish(),
});

export type WordInput = z.infer<typeof WordInputSchema>;

/**
 * The set of dictionary-entry fields an edit may change.
 */
export const EDITABLE_FIELDS = [
  "word",
  "translation",
  "definition",
  "type",
  "root",
  "tags",
  "antonyms",
  "examples",
  "morphology",
] as const;

/**
 * Fields an edit may change, each reusing the canonical field schema above.
 * `nullable` because a nullable column can be cleared by passing `null`; a
 * field left out of the payload is untouched.
 */
export const WordUpdatesSchema = z.object({
  word: z.string().min(1).optional(),
  translation: z.string().min(1).optional(),
  definition: z.string().nullable().optional(),
  type: WordTypeSchema.optional(),
  root: RootLettersSchema.nullable().optional(),
  tags: TagsSchema.nullable().optional(),
  antonyms: z.array(AntonymSchema).nullable().optional(),
  examples: z.array(ExampleSchema).nullable().optional(),
  morphology: MorphologySchema.nullable().optional(),
});

export type WordUpdates = z.infer<typeof WordUpdatesSchema>;
