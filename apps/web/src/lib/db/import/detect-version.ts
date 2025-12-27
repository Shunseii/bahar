import { z } from "zod";

const LATEST_VERSION = 1;

const VersionedDataSchema = z.object({
  version: z.number().int().positive(),
});

/**
 * Detects the version of an import file.
 * - If the data has a `version` field, uses that version
 * - If no version field (legacy format), assumes v1
 */
export function detectVersion(data: unknown): number {
  // Check if data has a version field
  const parsed = VersionedDataSchema.safeParse(data);

  if (parsed.success) {
    return parsed.data.version;
  }

  // Legacy format (no version field, just an array) = v1
  if (Array.isArray(data)) {
    return 1;
  }

  throw new Error("Unknown import format: expected versioned object or array");
}

/**
 * Extracts the entries array from import data.
 * Handles both versioned format (with `entries` key) and legacy format (raw array).
 */
export function extractEntries(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    // Legacy v1 format - data is the array itself
    return data;
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "entries" in data &&
    Array.isArray((data as { entries: unknown }).entries)
  ) {
    // Versioned format - entries are in `entries` key
    return (data as { entries: unknown[] }).entries;
  }

  throw new Error("Unknown import format: could not extract entries from data");
}

export { LATEST_VERSION };
