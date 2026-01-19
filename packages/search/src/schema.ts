/**
 * Orama schema for dictionary entries
 */

import type { Antonym, Example } from "@bahar/drizzle-user-db-schemas";
import type { Orama } from "@orama/orama";

/**
 * Schema definition for dictionary entries in Orama
 * Only these fields will be indexed for search
 *
 * Fields ending in `_exact` store the original Arabic text without normalization,
 * allowing exact matches to rank higher than normalized/fuzzy matches.
 */
export const dictionarySchema = {
  created_at_timestamp_ms: "number",
  updated_at_timestamp_ms: "number",

  word: "string",
  translation: "string",
  definition: "string",
  type: "enum",
  root: "string[]",
  tags: "enum[]",
  "morphology.ism.singular": "string",
  "morphology.ism.plurals": "string[]",
  "morphology.verb.past_tense": "string",
  "morphology.verb.present_tense": "string",
  "morphology.verb.masadir": "string[]",
} as const;

/**
 * Morphology structure flattened for Orama indexing.
 * Includes both normalized and exact variants.
 */
export interface IndexedMorphology {
  ism?: {
    singular?: string;
    plurals?: string[];
    singular_exact?: string;
    plurals_exact?: string[];
  };
  verb?: {
    past_tense?: string;
    present_tense?: string;
    masadir?: string[];
    past_tense_exact?: string;
    present_tense_exact?: string;
    masadir_exact?: string[];
  };
}

/**
 * Document type for dictionary entries in Orama
 * Fields not in dictionarySchema are stored but not indexed
 */
export interface DictionaryDocument {
  id: string;
  word: string;
  word_exact?: string;
  translation: string;
  created_at?: string;
  created_at_timestamp_ms?: number;
  updated_at?: string;
  updated_at_timestamp_ms?: number;
  definition?: string;
  type?: string;
  root?: string[];
  tags?: string[];
  morphology?: IndexedMorphology;
  antonyms?: Antonym[];
  examples?: Example[];
}

/**
 * Type for the Orama database with dictionary schema
 */
export type DictionaryOrama = Orama<typeof dictionarySchema>;
