import { describe, expect, it } from "vitest";
import { createImportStatements } from "./index";
import type { ImportWordV1 } from "./schema";

type Statement = ReturnType<
  typeof createImportStatements
>["flashcards"][number];

/** Positional args of the flashcard insert, in the order the statement binds them. */
const readFlashcard = (statement: Statement) => {
  const [
    id,
    dictionaryEntryId,
    difficulty,
    due,
    dueTimestampMs,
    elapsedDays,
    lapses,
    lastReview,
    lastReviewTimestampMs,
    reps,
    scheduledDays,
    stability,
    state,
    direction,
    isHidden,
  ] = statement.args;

  return {
    id,
    dictionaryEntryId,
    difficulty,
    due,
    dueTimestampMs,
    elapsedDays,
    lapses,
    lastReview,
    lastReviewTimestampMs,
    reps,
    scheduledDays,
    stability,
    state,
    direction,
    isHidden,
  };
};

const directionsOf = (statements: Statement[]) =>
  statements.map((statement) => readFlashcard(statement).direction);

const flashcardFor = (statements: Statement[], direction: string) => {
  const match = statements
    .map(readFlashcard)
    .find((flashcard) => flashcard.direction === direction);

  if (!match) {
    throw new Error(`No ${direction} flashcard statement was emitted`);
  }

  return match;
};

const REVIEWED_CARD: NonNullable<ImportWordV1["flashcard"]> = {
  difficulty: 6.32,
  due: "2025-12-01T04:26:40.315Z",
  due_timestamp: 1_764_563_200,
  elapsed_days: 4,
  lapses: 2,
  last_review: "2025-11-20T04:26:40.315Z",
  last_review_timestamp: 1_763_612_800,
  reps: 7,
  scheduled_days: 11,
  stability: 18.5,
  state: 2,
};

const makeWord = (overrides: Partial<ImportWordV1> = {}): ImportWordV1 => ({
  id: "N3WMRETxCG0v84LOv09Yq",
  word: "مِمحاَة",
  translation: "eraser",
  ...overrides,
});

describe("createImportStatements (v1)", () => {
  it("creates only a forward card for an entry with forward-only flashcard data", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({ flashcard: REVIEWED_CARD }),
    });

    // A forward-only export means the user had reverse turned off, and reverse
    // existence is row presence, so no reverse statement may be emitted.
    expect(directionsOf(flashcards)).toEqual(["forward"]);
  });

  it("creates a forward and a reverse card for an entry with reverse flashcard data", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({
        flashcard: REVIEWED_CARD,
        flashcard_reverse: { ...REVIEWED_CARD, reps: 3, difficulty: 4.1 },
      }),
    });

    expect(directionsOf(flashcards)).toEqual(["forward", "reverse"]);

    const reverse = flashcardFor(flashcards, "reverse");

    expect(reverse).toMatchObject({
      dictionaryEntryId: "N3WMRETxCG0v84LOv09Yq",
      difficulty: 4.1,
      due: REVIEWED_CARD.due,
      dueTimestampMs: REVIEWED_CARD.due_timestamp * 1000,
      elapsedDays: REVIEWED_CARD.elapsed_days,
      lapses: REVIEWED_CARD.lapses,
      lastReview: REVIEWED_CARD.last_review,
      lastReviewTimestampMs: (REVIEWED_CARD.last_review_timestamp ?? 0) * 1000,
      reps: 3,
      scheduledDays: REVIEWED_CARD.scheduled_days,
      stability: REVIEWED_CARD.stability,
      state: REVIEWED_CARD.state,
      isHidden: 0,
    });
  });

  it("creates a reverse card for an entry with reverse-only flashcard data", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({ flashcard_reverse: REVIEWED_CARD }),
    });

    // Forward is unconditional, and present reverse data is still honoured.
    expect(directionsOf(flashcards)).toEqual(["forward", "reverse"]);

    expect(flashcardFor(flashcards, "reverse").reps).toBe(REVIEWED_CARD.reps);

    // The missing forward card falls back to a fresh empty card.
    expect(flashcardFor(flashcards, "forward")).toMatchObject({
      reps: 0,
      state: 0,
      lastReview: null,
      lastReviewTimestampMs: null,
    });
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

      // The export carried no FSRS state, so both cards are born fresh.
      expect(flashcardFor(flashcards, "reverse")).toMatchObject({
        reps: 0,
        state: 0,
        lapses: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        lastReview: null,
        lastReviewTimestampMs: null,
        isHidden: 0,
      });
    });

    it("defaults createReverseByDefault to off when omitted", () => {
      const { flashcards } = createImportStatements({ word: makeWord() });

      expect(directionsOf(flashcards)).toEqual(["forward"]);
    });
  });

  it("keeps createReverseByDefault from overriding explicit forward-only data", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({ flashcard: REVIEWED_CARD }),
      createReverseByDefault: true,
    });

    // Flashcard data in the file is authoritative and wins over the account
    // default.
    expect(directionsOf(flashcards)).toEqual(["forward"]);
  });

  it("gives every flashcard statement its own id scoped to the entry", () => {
    const { flashcards } = createImportStatements({
      word: makeWord(),
      createReverseByDefault: true,
    });

    const [forward, reverse] = flashcards.map(readFlashcard);

    expect(forward.id).not.toBe(reverse.id);
    expect(forward.dictionaryEntryId).toBe("N3WMRETxCG0v84LOv09Yq");
    expect(reverse.dictionaryEntryId).toBe("N3WMRETxCG0v84LOv09Yq");
  });

  it("upserts the dictionary entry so re-importing the same file is idempotent", () => {
    const { dictEntry } = createImportStatements({ word: makeWord() });

    expect(dictEntry.args[0]).toBe("N3WMRETxCG0v84LOv09Yq");
    expect(dictEntry.args[1]).toBe("مِمحاَة");
    expect(dictEntry.args[2]).toBe("eraser");
    expect(dictEntry.sql).toContain("ON CONFLICT(id) DO UPDATE SET");
  });

  it("upserts flashcards on (entry, direction) so re-importing keeps one card per direction", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({
        flashcard: REVIEWED_CARD,
        flashcard_reverse: REVIEWED_CARD,
      }),
    });

    for (const statement of flashcards) {
      expect(statement.sql).toContain(
        "ON CONFLICT(dictionary_entry_id, direction) DO UPDATE SET"
      );
    }
  });

  it("converts exported second-precision timestamps to milliseconds on the entry", () => {
    const { dictEntry } = createImportStatements({
      word: makeWord({
        created_at: "2025-11-12T04:26:40.315Z",
        created_at_timestamp: 1_762_921_600,
        updated_at: "2025-11-20T04:26:40.315Z",
        updated_at_timestamp: 1_763_612_800,
      }),
    });

    expect(dictEntry.args[10]).toBe("2025-11-12T04:26:40.315Z");
    expect(dictEntry.args[11]).toBe(1_762_921_600 * 1000);
    expect(dictEntry.args[12]).toBe("2025-11-20T04:26:40.315Z");
    expect(dictEntry.args[13]).toBe(1_763_612_800 * 1000);
  });
});
