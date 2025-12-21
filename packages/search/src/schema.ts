/**
 * Orama schema for dictionary entries
 */

import type { Orama } from "@orama/orama";
import type { Morphology, Antonym, Example } from "@bahar/drizzle-user-db-schemas";

/**
 * Schema definition for dictionary entries in Orama
 * Only these fields will be indexed for search
 */
export const dictionarySchema = {
  created_at_timestamp_ms: "number",
  updated_at_timestamp_ms: "number",
  word: "string",
  translation: "string",
  definition: "string",
  type: "enum",
  root: "string[]",
  tags: "string[]",
} as const;

/**
 * Document type for dictionary entries in Orama
 * Fields not in dictionarySchema are stored but not indexed
 */
export interface DictionaryDocument {
  id: string;
  word: string;
  translation: string;
  created_at?: string;
  created_at_timestamp_ms?: number;
  updated_at?: string;
  updated_at_timestamp_ms?: number;
  definition?: string;
  type?: string;
  root?: string[];
  tags?: string[];
  morphology?: Morphology;
  antonyms?: Antonym[];
  examples?: Example[];
}

/**
 * Type for the Orama database with dictionary schema
 */
export type DictionaryOrama = Orama<typeof dictionarySchema>;
