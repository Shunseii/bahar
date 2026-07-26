import { describe, expect, it } from "vitest";
import {
  detectVersion,
  extractEntries,
  LATEST_VERSION,
} from "./detect-version";
import { parseImportData } from "./index";

const VALID_ENTRY = {
  id: "entry-1",
  word: "كتاب",
  translation: "book",
  type: "ism",
};

describe("detectVersion", () => {
  it("treats a bare array as v1, the format that predates versioning", () => {
    expect(detectVersion([VALID_ENTRY])).toBe(1);
    expect(detectVersion([])).toBe(1);
  });

  it("reads the version off a versioned object", () => {
    expect(detectVersion({ version: 2, entries: [] })).toBe(2);
  });

  it("rejects data that is neither a versioned object nor an array", () => {
    expect(() => detectVersion({ entries: [] })).toThrow(
      "Unknown import format"
    );
    expect(() => detectVersion("nope")).toThrow("Unknown import format");
    expect(() => detectVersion(null)).toThrow("Unknown import format");
  });

  it("rejects a non-positive or fractional version rather than trusting it", () => {
    // These fail the versioned-object schema and are not arrays, so there is no
    // legacy fallback to land on.
    expect(() => detectVersion({ version: 0, entries: [] })).toThrow(
      "Unknown import format"
    );
    expect(() => detectVersion({ version: 1.5, entries: [] })).toThrow(
      "Unknown import format"
    );
  });
});

describe("extractEntries", () => {
  it("returns a bare array unchanged", () => {
    expect(extractEntries([VALID_ENTRY])).toEqual([VALID_ENTRY]);
  });

  it("unwraps the entries key of a versioned object", () => {
    expect(extractEntries({ version: 1, entries: [VALID_ENTRY] })).toEqual([
      VALID_ENTRY,
    ]);
  });

  it("rejects data with no extractable entries", () => {
    expect(() => extractEntries({ version: 1 })).toThrow(
      "could not extract entries"
    );
    expect(() => extractEntries({ entries: "not an array" })).toThrow(
      "could not extract entries"
    );
    expect(() => extractEntries(null)).toThrow("could not extract entries");
  });
});

describe("parseImportData", () => {
  it("validates a legacy array and reports it as v1", () => {
    const { version, entries } = parseImportData([VALID_ENTRY]);

    expect(version).toBe(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject(VALID_ENTRY);
  });

  it("applies schema defaults to partial flashcard data", () => {
    const { entries } = parseImportData([
      {
        ...VALID_ENTRY,
        flashcard: {
          due: "2025-12-01T04:26:40.315Z",
          due_timestamp: 1_764_563_200,
        },
      },
    ]);

    // The schema fills the FSRS fields the file left out, so downstream code can
    // read them without its own fallbacks.
    expect(entries[0].flashcard).toMatchObject({
      difficulty: 0,
      elapsed_days: 0,
      lapses: 0,
      reps: 0,
      scheduled_days: 0,
      stability: 0,
      state: 0,
    });
  });

  it("rejects an entry missing a required field", () => {
    expect(() => parseImportData([{ id: "entry-1", word: "كتاب" }])).toThrow(
      "Invalid v1 import data"
    );
  });

  it("rejects an entry with no word type", () => {
    const { type: _omitted, ...withoutType } = VALID_ENTRY;

    // dictionary_entries.type is NOT NULL, so this has to fail here rather than
    // part-way through the insert transaction.
    expect(() => parseImportData([withoutType])).toThrow(
      "Invalid v1 import data"
    );
  });

  it("rejects a word type outside the known set", () => {
    expect(() => parseImportData([{ ...VALID_ENTRY, type: "verb" }])).toThrow(
      "Invalid v1 import data"
    );
  });

  it("defaults a flashcard's learning step position to zero", () => {
    const { entries } = parseImportData([
      {
        ...VALID_ENTRY,
        flashcard: {
          due: "2025-12-01T04:26:40.315Z",
          due_timestamp: 1_764_563_200,
        },
      },
    ]);

    expect(entries[0].flashcard?.learning_steps).toBe(0);
  });

  it("rejects a flashcard with a due date that is not a datetime", () => {
    expect(() =>
      parseImportData([
        {
          ...VALID_ENTRY,
          flashcard: { due: "last tuesday", due_timestamp: 1 },
        },
      ])
    ).toThrow("Invalid v1 import data");
  });

  it("rejects an unsupported version", () => {
    expect(() => parseImportData({ version: 99, entries: [] })).toThrow(
      "Unsupported import version: 99"
    );
  });

  it("exposes the latest version the app writes", () => {
    expect(LATEST_VERSION).toBe(1);
  });
});
