import {
  AntonymSchema,
  ExampleSchema,
  MorphologySchema,
  RootLettersSchema,
  TagsSchema,
  WordTypeSchema,
} from "@bahar/drizzle-user-db-schemas";
import { z } from "zod";

/**
 * A word to add, as accepted on stdin. Reuses the same field schemas the app's
 * dictionary schema is built from, so a word that validates here is a word the
 * app would accept. Server-managed fields (id, timestamps) and flashcards are
 * not part of the input -- the CLI generates the id and the flashcard pair.
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
 * Parses the `add` payload: a JSON array of word objects on stdin. Throws on
 * invalid JSON, a non-array payload, or any word that fails schema validation
 * (with the offending index and reason).
 */
export const parseWordInput = (stdin: string | null): WordInput[] => {
  if (!stdin || stdin.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch {
    throw new Error(
      'Could not parse stdin as JSON. Expected an array of word objects like [{"word": "...", "translation": "...", "type": "ism"}].'
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of word objects on stdin.");
  }

  return parsed.map((entry, index) => {
    const result = WordInputSchema.safeParse(entry);
    if (!result.success) {
      throw new Error(
        `Word at index ${index} is invalid: ${z.prettifyError(result.error)}`
      );
    }
    return result.data;
  });
};
