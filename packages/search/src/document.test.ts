import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { describe, expect, it } from "vitest";
import { toOramaDocument } from "./document";

const baseEntry: SelectDictionaryEntry = {
  id: "entry-1",
  created_at: "2026-01-01T00:00:00.000Z",
  created_at_timestamp_ms: 1_767_225_600_000,
  updated_at: "2026-02-01T00:00:00.000Z",
  updated_at_timestamp_ms: 1_769_904_000_000,
  word: "كِتَاب",
  translation: "book",
  definition: null,
  type: "ism",
  root: null,
  tags: null,
  antonyms: null,
  examples: null,
  morphology: null,
};

describe("toOramaDocument", () => {
  it("mirrors the word into its exact-match twin", () => {
    const doc = toOramaDocument({ entry: baseEntry });

    expect(doc.word).toBe("كِتَاب");
    expect(doc.word_exact).toBe("كِتَاب");
  });

  it("coalesces nulls to undefined", () => {
    const doc = toOramaDocument({ entry: baseEntry });

    expect(doc.definition).toBeUndefined();
    expect(doc.root).toBeUndefined();
    expect(doc.tags).toBeUndefined();
    expect(doc.antonyms).toBeUndefined();
    expect(doc.examples).toBeUndefined();
    expect(doc.morphology).toBeUndefined();
  });

  it("flattens ism morphology and mirrors the exact fields", () => {
    const doc = toOramaDocument({
      entry: {
        ...baseEntry,
        morphology: {
          ism: {
            singular: "كِتَاب",
            plurals: [{ word: "كُتُب" }, { word: "كُتْب" }],
          },
        },
      },
    });

    expect(doc.morphology?.ism).toEqual({
      singular: "كِتَاب",
      plurals: ["كُتُب", "كُتْب"],
      singular_exact: "كِتَاب",
      plurals_exact: ["كُتُب", "كُتْب"],
    });
    expect(doc.morphology?.verb).toBeUndefined();
  });

  it("flattens verb morphology and mirrors the exact fields", () => {
    const doc = toOramaDocument({
      entry: {
        ...baseEntry,
        type: "fi'l",
        morphology: {
          verb: {
            past_tense: "كَتَبَ",
            present_tense: "يَكْتُبُ",
            masadir: [{ word: "كِتَابَة" }],
          },
        },
      },
    });

    expect(doc.morphology?.verb).toEqual({
      past_tense: "كَتَبَ",
      present_tense: "يَكْتُبُ",
      masadir: ["كِتَابَة"],
      past_tense_exact: "كَتَبَ",
      present_tense_exact: "يَكْتُبُ",
      masadir_exact: ["كِتَابَة"],
    });
    expect(doc.morphology?.ism).toBeUndefined();
  });

  it("leaves plurals and masadir undefined when the morphology omits them", () => {
    const doc = toOramaDocument({
      entry: {
        ...baseEntry,
        morphology: { ism: { singular: "كِتَاب" } },
      },
    });

    expect(doc.morphology?.ism?.plurals).toBeUndefined();
    expect(doc.morphology?.ism?.plurals_exact).toBeUndefined();
  });

  it("omits the flashcard-derived fields when they aren't supplied", () => {
    const doc = toOramaDocument({ entry: baseEntry });

    // Absent rather than undefined, so spreading over an indexed document
    // can't clobber values that are already there.
    expect("max_difficulty" in doc).toBe(false);
    expect("last_review_timestamp_ms" in doc).toBe(false);
  });

  it("includes the flashcard-derived fields when supplied", () => {
    const doc = toOramaDocument({
      entry: baseEntry,
      maxDifficulty: 7.5,
      lastReviewTimestampMs: 1_770_000_000_000,
    });

    expect(doc.max_difficulty).toBe(7.5);
    expect(doc.last_review_timestamp_ms).toBe(1_770_000_000_000);
  });

  it("keeps a zero difficulty rather than treating it as absent", () => {
    const doc = toOramaDocument({
      entry: baseEntry,
      maxDifficulty: 0,
      lastReviewTimestampMs: 0,
    });

    expect(doc.max_difficulty).toBe(0);
    expect(doc.last_review_timestamp_ms).toBe(0);
  });

  it("carries the entry's timestamps and stored fields through", () => {
    const doc = toOramaDocument({
      entry: {
        ...baseEntry,
        definition: "a written work",
        root: ["ك", "ت", "ب"],
        tags: ["noun"],
        antonyms: [{ word: "قَلَم" }],
        examples: [{ sentence: "قرأت الكتاب", translation: "I read the book" }],
      },
    });

    expect(doc.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(doc.created_at_timestamp_ms).toBe(1_767_225_600_000);
    expect(doc.updated_at).toBe("2026-02-01T00:00:00.000Z");
    expect(doc.updated_at_timestamp_ms).toBe(1_769_904_000_000);
    expect(doc.definition).toBe("a written work");
    expect(doc.root).toEqual(["ك", "ت", "ب"]);
    expect(doc.tags).toEqual(["noun"]);
    expect(doc.antonyms).toEqual([{ word: "قَلَم" }]);
    expect(doc.examples).toEqual([
      { sentence: "قرأت الكتاب", translation: "I read the book" },
    ]);
  });
});
