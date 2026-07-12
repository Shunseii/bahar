import { dictionaryEntries, flashcards } from "@bahar/drizzle-user-db-schemas";
import { eq, inArray } from "drizzle-orm";
import type { UserDb } from "./db";

export type DeleteResult = { id: string; word: string };

export type ApplyDeletesResult = {
  deleted: DeleteResult[];
  missing: string[];
};

/**
 * Deletes each dictionary entry and its flashcards. This is destructive and
 * irreversible: it permanently loses the entries' FSRS review history. Ids with
 * no matching entry are returned in `missing` and skipped.
 *
 * Flashcards are deleted explicitly (not via ON DELETE CASCADE) because
 * sync-wasm doesn't support cascade -- mirrors the delete mutation in
 * @bahar/db-operations. All deletes run in one atomic batch.
 */
export const applyDeletes = async ({
  db,
  ids,
}: {
  db: UserDb;
  ids: string[];
}): Promise<ApplyDeletesResult> => {
  const existing = await db
    .select({ id: dictionaryEntries.id, word: dictionaryEntries.word })
    .from(dictionaryEntries)
    .where(inArray(dictionaryEntries.id, ids));

  const existingById = new Map(existing.map((row) => [row.id, row.word]));
  const missing = ids.filter((id) => !existingById.has(id));
  const foundIds = ids.filter((id) => existingById.has(id));

  const statements = [];
  for (const id of foundIds) {
    statements.push(
      db.delete(flashcards).where(eq(flashcards.dictionary_entry_id, id))
    );
    statements.push(
      db.delete(dictionaryEntries).where(eq(dictionaryEntries.id, id))
    );
  }

  if (statements.length > 0) {
    await db.batch(
      statements as [
        (typeof statements)[number],
        ...(typeof statements)[number][],
      ]
    );
  }

  const deleted: DeleteResult[] = foundIds.map((id) => ({
    id,
    word: existingById.get(id) as string,
  }));

  return { deleted, missing };
};
