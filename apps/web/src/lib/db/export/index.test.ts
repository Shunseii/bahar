import type {
  RawDictionaryEntry,
  SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { describe, expect, it } from "vitest";
import { transformForExport } from "./index";

const CREATED_AT = "2025-11-12T04:26:40.315Z";
const UPDATED_AT = "2025-11-20T04:26:40.315Z";
const DUE_AT = "2025-12-01T04:26:40.315Z";
const REVIEWED_AT = "2025-11-25T04:26:40.315Z";

/** Rows come off `SELECT *`, so json columns arrive as raw strings. */
const makeRawEntry = (
  overrides: Partial<RawDictionaryEntry> = {}
): RawDictionaryEntry => ({
  id: "entry-1",
  word: "كتاب",
  translation: "book",
  definition: null,
  type: "ism",
  root: null,
  tags: null,
  antonyms: null,
  examples: null,
  morphology: null,
  created_at: CREATED_AT,
  created_at_timestamp_ms: Date.parse(CREATED_AT),
  updated_at: UPDATED_AT,
  updated_at_timestamp_ms: Date.parse(UPDATED_AT),
  ...overrides,
});

const makeFlashcardRow = (
  overrides: Partial<SelectFlashcard> = {}
): SelectFlashcard => ({
  id: "card-1",
  dictionary_entry_id: "entry-1",
  difficulty: 6.32,
  due: DUE_AT,
  due_timestamp_ms: Date.parse(DUE_AT),
  elapsed_days: 4,
  lapses: 2,
  last_review: REVIEWED_AT,
  last_review_timestamp_ms: Date.parse(REVIEWED_AT),
  learning_steps: 0,
  reps: 7,
  scheduled_days: 11,
  stability: 18.5,
  state: 2,
  direction: "forward",
  is_hidden: false,
  ...overrides,
});

const unwrap = (result: ReturnType<typeof transformForExport>) => {
  if (!result.ok) {
    throw new Error(`Expected an ok result, got ${JSON.stringify(result)}`);
  }

  return result.value;
};

describe("transformForExport", () => {
  it("omits timestamps and flashcards when flashcards are excluded", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry(),
        flashcards: [makeFlashcardRow()],
        includeFlashcards: false,
      })
    );

    expect(exported).toEqual({
      id: "entry-1",
      word: "كتاب",
      translation: "book",
      definition: undefined,
      type: "ism",
      root: undefined,
      tags: undefined,
      antonyms: undefined,
      examples: undefined,
      morphology: undefined,
    });
  });

  it("parses json columns back into structured values", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry({
          definition: "ما يُكتب فيه",
          root: JSON.stringify(["ك", "ت", "ب"]),
          tags: JSON.stringify(["معهد الخليل"]),
          antonyms: JSON.stringify([{ word: "قلم" }]),
          examples: JSON.stringify([{ sentence: "قرأت الكتاب" }]),
          morphology: JSON.stringify({ ism: { gender: "masculine" } }),
        }),
        flashcards: [],
        includeFlashcards: false,
      })
    );

    expect(exported).toMatchObject({
      definition: "ما يُكتب فيه",
      root: ["ك", "ت", "ب"],
      tags: ["معهد الخليل"],
      antonyms: [{ word: "قلم" }],
      examples: [{ sentence: "قرأت الكتاب" }],
      morphology: { ism: { gender: "masculine" } },
    });
  });

  it("exports a forward-only card without a reverse key", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry(),
        flashcards: [makeFlashcardRow({ direction: "forward" })],
        includeFlashcards: true,
      })
    );

    expect(exported.flashcard).toBeDefined();
    // Reverse existence is row presence on both sides of the boundary, so a
    // missing reverse row must not produce a reverse key.
    expect("flashcard_reverse" in exported).toBe(false);
  });

  it("splits forward and reverse rows into their own keys", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry(),
        flashcards: [
          makeFlashcardRow({ id: "card-fwd", direction: "forward", reps: 7 }),
          makeFlashcardRow({ id: "card-rev", direction: "reverse", reps: 3 }),
        ],
        includeFlashcards: true,
      })
    );

    expect(exported.flashcard?.reps).toBe(7);
    expect(exported.flashcard_reverse?.reps).toBe(3);
  });

  it("exports a reverse-only card without a forward key", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry(),
        flashcards: [makeFlashcardRow({ direction: "reverse" })],
        includeFlashcards: true,
      })
    );

    expect(exported.flashcard_reverse).toBeDefined();
    expect("flashcard" in exported).toBe(false);
  });

  it("converts millisecond timestamps down to export seconds", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry(),
        flashcards: [makeFlashcardRow()],
        includeFlashcards: true,
      })
    );

    expect(exported.created_at).toBe(CREATED_AT);
    expect(exported.created_at_timestamp).toBe(
      Math.floor(Date.parse(CREATED_AT) / 1000)
    );
    expect(exported.updated_at_timestamp).toBe(
      Math.floor(Date.parse(UPDATED_AT) / 1000)
    );
    expect(exported.flashcard?.due_timestamp).toBe(
      Math.floor(Date.parse(DUE_AT) / 1000)
    );
    expect(exported.flashcard?.last_review_timestamp).toBe(
      Math.floor(Date.parse(REVIEWED_AT) / 1000)
    );
  });

  it("exports the card's learning step position", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry(),
        flashcards: [makeFlashcardRow({ learning_steps: 2 })],
        includeFlashcards: true,
      })
    );

    expect(exported.flashcard?.learning_steps).toBe(2);
  });

  it("preserves a never-reviewed card's null review fields", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry(),
        flashcards: [
          makeFlashcardRow({
            last_review: null,
            last_review_timestamp_ms: null,
          }),
        ],
        includeFlashcards: true,
      })
    );

    expect(exported.flashcard?.last_review).toBeNull();
    expect(exported.flashcard?.last_review_timestamp).toBeNull();
  });

  it("substitutes zeroes for null FSRS columns", () => {
    const exported = unwrap(
      transformForExport({
        entry: makeRawEntry(),
        flashcards: [
          makeFlashcardRow({
            difficulty: null,
            elapsed_days: null,
            lapses: null,
            reps: null,
            scheduled_days: null,
            stability: null,
            state: null,
            learning_steps: null,
          }),
        ],
        includeFlashcards: true,
      })
    );

    expect(exported.flashcard).toMatchObject({
      learning_steps: 0,
      difficulty: 0,
      elapsed_days: 0,
      lapses: 0,
      reps: 0,
      scheduled_days: 0,
      stability: 0,
      state: 0,
    });
  });

  it("reports which field is corrupt so the caller can skip the entry", () => {
    const result = transformForExport({
      entry: makeRawEntry({ tags: "{not json" }),
      flashcards: [],
      includeFlashcards: false,
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected corrupt json to produce an error result");
    }

    expect(result.error).toMatchObject({
      entryId: "entry-1",
      word: "كتاب",
      field: "tags",
    });
    expect(result.error.reason).toBeTruthy();
  });
});
