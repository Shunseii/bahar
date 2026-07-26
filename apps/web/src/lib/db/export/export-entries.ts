import type { ConvertDictionaryEntryError } from "@bahar/db-operations";
import type {
  RawDictionaryEntry,
  SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import type { ImportWordV1 } from "../import/v1/schema";
import { transformForExport } from "./index";

/**
 * The subset of the database surface an export needs. Declared structurally so
 * the same code runs against sync-wasm in the browser and the node binding in
 * tests.
 */
type ExportDb = {
  all: (sql: string, args?: unknown[]) => Promise<unknown[]>;
};

/**
 * Reads every dictionary entry with its flashcards and transforms them into the
 * latest export format.
 *
 * An entry whose stored json cannot be parsed is skipped rather than failing the
 * whole export, and returned in `skipped` so the caller can report it. The
 * reason only lived in a console warning before, which meant a user who saw
 * "3 entries were skipped" had no way to learn which ones.
 */
export const exportEntries = async ({
  db,
  includeFlashcards,
}: {
  db: ExportDb;
  includeFlashcards: boolean;
}): Promise<{
  entries: ImportWordV1[];
  skipped: ConvertDictionaryEntryError[];
}> => {
  const rows = (await db.all(
    "SELECT * FROM dictionary_entries"
  )) as RawDictionaryEntry[];

  const entries: ImportWordV1[] = [];
  const skipped: ConvertDictionaryEntryError[] = [];

  for (const entry of rows) {
    // transformForExport keys each card off its own direction column, so the
    // ordering is not what makes the split correct -- it only keeps the emitted
    // key order stable so two exports of the same data diff cleanly.
    const flashcards = (await db.all(
      "SELECT * FROM flashcards WHERE dictionary_entry_id = ? ORDER BY direction",
      [entry.id]
    )) as SelectFlashcard[];

    const result = transformForExport({ entry, flashcards, includeFlashcards });

    if (!result.ok) {
      skipped.push(result.error);
      continue;
    }

    entries.push(result.value);
  }

  return { entries, skipped };
};
