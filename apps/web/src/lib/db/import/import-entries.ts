import { batchArray, createImportStatements, type parseImportData } from ".";

type ValidatedImport = ReturnType<typeof parseImportData>;
type ImportEntry = ValidatedImport["entries"][number];

/**
 * The subset of the database surface an import needs. Declared structurally so
 * the same code runs against sync-wasm in the browser and the node binding in
 * tests.
 */
type ImportDb = {
  run: (sql: string, args: unknown[]) => Promise<unknown>;
  transaction: (
    fn: (batch: ImportEntry[]) => Promise<void>
  ) => (batch: ImportEntry[]) => Promise<unknown>;
};

export type ImportProgress = { current: number; total: number };

const DEFAULT_BATCH_SIZE = 100;

/**
 * Writes validated import entries to the database, one transaction per batch so
 * a failure part-way through rolls that batch back rather than leaving it half
 * applied.
 *
 * `createReverseByDefault` is passed in rather than read here: the settings
 * operation resolves its own connection through the app's module-level
 * database, which would bypass the `db` given to this function.
 */
export const importEntries = async ({
  db,
  entries,
  version,
  createReverseByDefault,
  batchSize = DEFAULT_BATCH_SIZE,
  onProgress,
}: {
  db: ImportDb;
  entries: ImportEntry[];
  version: number;
  createReverseByDefault: boolean;
  batchSize?: number;
  onProgress?: (progress: ImportProgress) => void;
}): Promise<{ entryCount: number; batchCount: number }> => {
  const batches = [...batchArray(entries, batchSize)];

  if (batches.length === 0) {
    return { entryCount: 0, batchCount: 0 };
  }

  // Reported before the first batch so a caller can render a determinate bar
  // during what is, on a large import, several seconds of work.
  onProgress?.({ current: 0, total: batches.length });

  const insertBatch = db.transaction(async (batch: ImportEntry[]) => {
    for (const entry of batch) {
      const { dictEntry, flashcards } = createImportStatements({
        entry,
        version,
        createReverseByDefault,
      });

      await db.run(dictEntry.sql, dictEntry.args);

      for (const flashcard of flashcards) {
        await db.run(flashcard.sql, flashcard.args);
      }
    }
  });

  for (const [index, batch] of batches.entries()) {
    await insertBatch(batch);

    onProgress?.({ current: index + 1, total: batches.length });
  }

  return { entryCount: entries.length, batchCount: batches.length };
};
