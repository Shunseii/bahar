import { describe, expect, it } from "vitest";
import { createImportStatements } from "./index";
import type { ImportWordV1 } from "./schema";

const DIRECTION_ARG_INDEX = 13;

const makeFlashcard = (): NonNullable<ImportWordV1["flashcard"]> => ({
  difficulty: 0,
  due: "2025-11-12T04:26:40.315Z",
  due_timestamp: 1_762_921_600,
  elapsed_days: 0,
  lapses: 0,
  last_review: null,
  last_review_timestamp: null,
  reps: 0,
  scheduled_days: 0,
  stability: 0,
  state: 0,
});

const makeWord = (overrides: Partial<ImportWordV1> = {}): ImportWordV1 => ({
  id: "N3WMRETxCG0v84LOv09Yq",
  word: "مِمحاَة",
  translation: "eraser",
  ...overrides,
});

const directionsOf = (
  flashcards: ReturnType<typeof createImportStatements>["flashcards"]
) => flashcards.map((statement) => statement.args[DIRECTION_ARG_INDEX]);

describe("createImportStatements (v1)", () => {
  it("creates only a forward card for an entry with forward-only flashcard data", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({ flashcard: makeFlashcard() }),
    });

    // A forward-only export means the user had reverse turned off, and reverse
    // existence is row presence, so no reverse statement may be emitted.
    expect(directionsOf(flashcards)).toEqual(["forward"]);
  });

  it("creates a forward and a reverse card for an entry with reverse flashcard data", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({
        flashcard: makeFlashcard(),
        flashcard_reverse: makeFlashcard(),
      }),
    });

    expect(directionsOf(flashcards)).toEqual(["forward", "reverse"]);

    // also assert the reverse statement carries the imported FSRS values
    // (difficulty, due, reps, state) rather than a fresh empty card
  });

  it("creates a reverse card for an entry with reverse-only flashcard data", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({ flashcard_reverse: makeFlashcard() }),
    });

    // Forward is unconditional, and present reverse data must still be honoured.
    expect(directionsOf(flashcards)).toEqual(["forward", "reverse"]);
  });

  describe("entries exported without flashcards", () => {
    it("creates only a forward card when createReverseByDefault is off", () => {
      const { flashcards } = createImportStatements({
        word: makeWord(),
        createReverseByDefault: false,
      });

      expect(directionsOf(flashcards)).toEqual(["forward"]);
    });

    it("creates a forward and a reverse card when createReverseByDefault is on", () => {
      const { flashcards } = createImportStatements({
        word: makeWord(),
        createReverseByDefault: true,
      });

      expect(directionsOf(flashcards)).toEqual(["forward", "reverse"]);

      // also assert the reverse statement uses fresh empty-card FSRS values
      // (reps 0, state 0, no last_review) since the export carried none
    });

    it("defaults createReverseByDefault to off when omitted", () => {
      const { flashcards } = createImportStatements({ word: makeWord() });

      expect(directionsOf(flashcards)).toEqual(["forward"]);
    });
  });

  it("keeps createReverseByDefault from overriding explicit forward-only data", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({ flashcard: makeFlashcard() }),
      createReverseByDefault: true,
    });

    // Flashcard data in the file is authoritative and wins over the account
    // default.
    expect(directionsOf(flashcards)).toEqual(["forward"]);
  });

  it("emits a dictionary entry statement carrying the entry id", () => {
    const { dictEntry } = createImportStatements({ word: makeWord() });

    expect(dictEntry.args[0]).toBe("N3WMRETxCG0v84LOv09Yq");

    // also assert the sql upserts on conflict rather than failing on re-import
  });
});
