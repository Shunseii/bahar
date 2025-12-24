import {
  detectVersion,
  extractEntries,
  LATEST_VERSION,
} from "./detect-version";
import { ImportSchemaV1 } from "./v1/schema";
import { createImportStatements as createImportStatementsV1 } from "./v1";

export { detectVersion, extractEntries, LATEST_VERSION };
export { ImportSchemaV1 } from "./v1/schema";
export { createImportStatements as createImportStatementsV1 } from "./v1";

/**
 * Parses and validates import data based on detected version.
 * Returns the validated entries array.
 */
export function parseImportData(data: unknown) {
  const version = detectVersion(data);
  const entries = extractEntries(data);

  switch (version) {
    case 1: {
      const result = ImportSchemaV1.safeParse(entries);
      if (!result.success) {
        throw new Error(`Invalid v1 import data: ${result.error.message}`);
      }
      return { version, entries: result.data };
    }
    default:
      throw new Error(`Unsupported import version: ${version}`);
  }
}

/**
 * Creates SQL statements for a single entry based on version.
 */
export function createImportStatements(entry: unknown, version: number) {
  switch (version) {
    case 1:
      return createImportStatementsV1(
        entry as Parameters<typeof createImportStatementsV1>[0],
      );
    default:
      throw new Error(`Unsupported import version: ${version}`);
  }
}

/**
 * Reads a file as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Batches an array into chunks of specified size
 */
export function* batchArray<T>(array: T[], batchSize: number) {
  for (let i = 0; i < array.length; i += batchSize) {
    yield array.slice(i, i + batchSize);
  }
}
