/**
 * @file TypeScript types for JSON fields in user database tables.
 */

// Dictionary types
export const WORD_TYPES = ["ism", "fi'l", "harf", "expression"] as const;

export type WordType = (typeof WORD_TYPES)[number];

export type RootLetters = string[];

export type Tags = string[];

export type Antonym = {
  word?: string;
};

export type Example = {
  sentence: string;
  context?: string;
  translation?: string;
};

export type Morphology = {
  ism?: {
    singular?: string;
    dual?: string;
    plurals?: Array<{
      word: string;
      details?: string;
    }>;
    gender?: "masculine" | "feminine";
    inflection?: "indeclinable" | "diptote" | "triptote";
  };
  verb?: {
    huroof?: Array<{
      harf: string;
      meaning?: string;
    }>;
    past_tense?: string;
    present_tense?: string;
    active_participle?: string;
    passive_participle?: string;
    imperative?: string;
    masadir?: Array<{
      word: string;
      details?: string;
    }>;
    form?: string;
    form_arabic?: string;
  };
};

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
