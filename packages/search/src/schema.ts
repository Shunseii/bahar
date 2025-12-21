/**
 * Orama schema for dictionary entries
 */

import type { Orama } from "@orama/orama";

/**
 * Schema definition for dictionary entries in Orama
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
}

/**
 * Type for the Orama database with dictionary schema
 */
export type DictionaryOrama = Orama<typeof dictionarySchema>;
