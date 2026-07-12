import {
  dictionaryEntries,
  type InsertDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { eq, inArray } from "drizzle-orm";
import type { UserDb } from "./db";
import type { EditItem } from "./edit-input";

export type EditResult = { id: string; fields: string[] };

export type ApplyEditsResult = {
  edited: EditResult[];
  missing: string[];
};

/**
 * Applies each edit to its dictionary entry in one atomic batch. Ids with no
 * matching entry are returned in `missing` and skipped (mirrors applyGrades).
 * Every edit bumps `updated_at` / `updated_at_timestamp_ms` -- the field that
 * drives sync ordering and maxUpdatedAt -- so an edit made here syncs like one
 * made in the app. Field mapping mirrors the editWord mutation.
 */
export const applyEdits = async ({
  db,
  items,
  now = new Date(),
}: {
  db: UserDb;
  items: EditItem[];
  now?: Date;
}): Promise<ApplyEditsResult> => {
  const ids = items.map((item) => item.id);
  const existing = await db
    .select({ id: dictionaryEntries.id })
    .from(dictionaryEntries)
    .where(inArray(dictionaryEntries.id, ids));
  const existingIds = new Set(existing.map((row) => row.id));

  const missing = ids.filter((id) => !existingIds.has(id));
  const found = items.filter((item) => existingIds.has(item.id));

  const updateStatements = [];
  const edited: EditResult[] = [];

  for (const { id, updates } of found) {
    const setValues: Partial<InsertDictionaryEntry> = {
      ...updates,
      updated_at: now.toISOString(),
      updated_at_timestamp_ms: now.getTime(),
    };

    updateStatements.push(
      db
        .update(dictionaryEntries)
        .set(setValues)
        .where(eq(dictionaryEntries.id, id))
    );
    edited.push({ id, fields: Object.keys(updates) });
  }

  if (updateStatements.length > 0) {
    await db.batch(
      updateStatements as [
        (typeof updateStatements)[number],
        ...(typeof updateStatements)[number][],
      ]
    );
  }

  return { edited, missing };
};
