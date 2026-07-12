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
 * The set of dictionary-entry fields an edit may change. Each reuses the app's
 * canonical field schema. `nullable` because a nullable column can be cleared
 * by passing `null`; a field left out of the payload is untouched.
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

const EditFieldsSchema = z.object({
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

export type EditUpdates = z.infer<typeof EditFieldsSchema>;

export type EditItem = {
  id: string;
  updates: EditUpdates;
};

/**
 * Parses the `edit` payload: a JSON array of `{ id, ...fields }` objects on
 * stdin. `updates` contains only the fields actually present in the payload
 * (so an omitted field is left untouched and an explicit `null` clears a
 * nullable column) -- the same contract as the app's editWord mutation. Throws
 * on invalid JSON, a missing/blank id, an unknown or invalid field, or a
 * duplicate id.
 */
export const parseEditInput = (stdin: string | null): EditItem[] => {
  if (!stdin || stdin.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch {
    throw new Error(
      'Could not parse stdin as JSON. Expected an array of edits like [{"id": "...", "translation": "..."}].'
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of edit objects on stdin.");
  }

  const items = parsed.map((entry, index): EditItem => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Edit at index ${index} must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id.length === 0) {
      throw new Error(`Edit at index ${index} must have a non-empty "id".`);
    }

    const { id, ...rest } = record;

    const providedKeys = Object.keys(rest);
    if (providedKeys.length === 0) {
      throw new Error(
        `Edit at index ${index} (id "${id}") has no fields to update.`
      );
    }

    const unknownKey = providedKeys.find(
      (key) => !(EDITABLE_FIELDS as readonly string[]).includes(key)
    );
    if (unknownKey) {
      throw new Error(
        `Edit at index ${index} (id "${id}") has unknown field "${unknownKey}". Editable fields: ${EDITABLE_FIELDS.join(", ")}.`
      );
    }

    const result = EditFieldsSchema.safeParse(rest);
    if (!result.success) {
      throw new Error(
        `Edit at index ${index} (id "${id}") is invalid: ${z.prettifyError(result.error)}`
      );
    }

    return { id, updates: result.data };
  });

  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) {
      throw new Error(`Duplicate id "${id}" in batch.`);
    }
    seen.add(id);
  }

  return items;
};
