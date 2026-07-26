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
    learningSteps,
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
    learningSteps,
    direction,
    isHidden,
  };
};

/** Positional args of the dictionary entry insert, in bind order. */
const readDictEntry = (statement: Statement) => {
  const [
    id,
    word,
    translation,
    definition,
    type,
    root,
    tags,
    antonyms,
    examples,
    morphology,
    createdAt,
    createdAtTimestampMs,
    updatedAt,
    updatedAtTimestampMs,
  ] = statement.args;

  return {
    id,
    word,
    translation,
    definition,
    type,
    root,
    tags,
    antonyms,
    examples,
    morphology,
    createdAt,
    createdAtTimestampMs,
    updatedAt,
    updatedAtTimestampMs,
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

/** Exports store second precision, so the import multiplies these back up. */
const toExportTimestamp = (iso: string) => Math.floor(Date.parse(iso) / 1000);

const DUE_AT = "2025-12-01T04:26:40.315Z";
const REVIEWED_AT = "2025-11-20T04:26:40.315Z";

const REVIEWED_CARD: NonNullable<ImportWordV1["flashcard"]> = {
  difficulty: 6.32,
  due: DUE_AT,
  due_timestamp: toExportTimestamp(DUE_AT),
  elapsed_days: 4,
  lapses: 2,
  last_review: REVIEWED_AT,
  last_review_timestamp: toExportTimestamp(REVIEWED_AT),
  learning_steps: 1,
  reps: 7,
  scheduled_days: 11,
  stability: 18.5,
  state: 2,
};

const makeWord = (overrides: Partial<ImportWordV1> = {}): ImportWordV1 => ({
  id: "N3WMRETxCG0v84LOv09Yq",
  word: "مِمحاَة",
  translation: "eraser",
  type: "ism",
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
      dueTimestampMs: toExportTimestamp(DUE_AT) * 1000,
      elapsedDays: REVIEWED_CARD.elapsed_days,
      lapses: REVIEWED_CARD.lapses,
      lastReview: REVIEWED_AT,
      lastReviewTimestampMs: toExportTimestamp(REVIEWED_AT) * 1000,
      reps: 3,
      scheduledDays: REVIEWED_CARD.scheduled_days,
      stability: REVIEWED_CARD.stability,
      state: REVIEWED_CARD.state,
      learningSteps: REVIEWED_CARD.learning_steps,
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
      learningSteps: 0,
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
        learningSteps: 0,
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

  it("binds learning_steps so the upsert can reset a card's step position", () => {
    const { flashcards } = createImportStatements({
      word: makeWord({
        flashcard: { ...REVIEWED_CARD, learning_steps: 2 },
      }),
    });

    // Without this column in the statement the upsert would reset every other
    // FSRS field while leaving a stale step position behind.
    expect(flashcardFor(flashcards, "forward").learningSteps).toBe(2);
    expect(flashcards[0].sql).toContain(
      "learning_steps = excluded.learning_steps"
    );
  });

  it("binds the word type, which the entries table requires", () => {
    const { dictEntry } = createImportStatements({
      word: makeWord({ type: "harf" }),
    });

    expect(readDictEntry(dictEntry).type).toBe("harf");
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

    expect(readDictEntry(dictEntry)).toMatchObject({
      id: "N3WMRETxCG0v84LOv09Yq",
      word: "مِمحاَة",
      translation: "eraser",
    });
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
    const createdAt = "2025-11-12T04:26:40.315Z";
    const updatedAt = REVIEWED_AT;

    const { dictEntry } = createImportStatements({
      word: makeWord({
        created_at: createdAt,
        created_at_timestamp: toExportTimestamp(createdAt),
        updated_at: updatedAt,
        updated_at_timestamp: toExportTimestamp(updatedAt),
      }),
    });

    expect(readDictEntry(dictEntry)).toMatchObject({
      createdAt,
      createdAtTimestampMs: toExportTimestamp(createdAt) * 1000,
      updatedAt,
      updatedAtTimestampMs: toExportTimestamp(updatedAt) * 1000,
    });
  });
});
