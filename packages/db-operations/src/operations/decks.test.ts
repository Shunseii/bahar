import {
  type DeckFilters,
  FlashcardState,
  type SelectDeck,
} from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../test/create-test-db";
import {
  insertDeck,
  insertDictionaryEntry,
  insertFlashcard,
} from "../test/factories";
import { makeDecksTable } from "./decks";

describe("decksTable", () => {
  let testDb: TestDb;
  let decksTable: ReturnType<typeof makeDecksTable>;

  beforeEach(async () => {
    testDb = await createTestDb();
    // Inject the real harness db directly -- no mocks. Mutations run through
    // the package's real write queue (imported by the factory), so the tests
    // exercise the actual serialized path.
    decksTable = makeDecksTable({
      getDb: async () => testDb.drizzleDb,
    });
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("create", () => {
    it("inserts a new deck and returns it", async () => {
      const deckInput = {
        name: "test deck",
        filters: {
          state: [FlashcardState.LEARNING, FlashcardState.REVIEW],
          types: ["ism", "fi'l"],
          tags: ["foo"],
        },
      } satisfies Omit<SelectDeck, "id">;

      const newDeck = await decksTable.create.mutation({ deck: deckInput });

      expect(newDeck).toMatchObject({
        id: expect.any(String),
        name: deckInput.name,
        filters: {
          state: expect.arrayContaining(deckInput.filters.state),
          types: expect.arrayContaining(deckInput.filters.types),
          tags: expect.arrayContaining(deckInput.filters.tags),
        },
      });

      const deckExists = await (
        await testDb.db.prepare("SELECT * FROM decks WHERE id = ?")
      ).get([newDeck.id]);

      expect(deckExists).toBeDefined();
    });

    it("stores null filters as null, not the string 'null'", async () => {
      const newDeck = await decksTable.create.mutation({
        deck: { name: "test deck", filters: null },
      });

      expect(newDeck.filters).toBeNull();

      const deckExists = (await (
        await testDb.db.prepare("SELECT * FROM decks WHERE id = ?")
      ).get([newDeck.id])) as { filters: unknown };

      expect(deckExists).toBeDefined();
      expect(deckExists.filters).toBeNull();
    });
  });

  describe("update", () => {
    it("updates only the provided fields, leaving others untouched", async () => {
      const deckInput = {
        name: "test deck",
        filters: {
          state: [FlashcardState.LEARNING, FlashcardState.REVIEW],
          types: ["ism", "fi'l"],
          tags: ["foo"],
        },
      } satisfies Omit<SelectDeck, "id">;

      const newDeck = await decksTable.create.mutation({ deck: deckInput });
      const updatedName = "updated deck";

      const updatedDeck = await decksTable.update.mutation({
        id: newDeck.id,
        updates: { name: updatedName },
      });

      expect(updatedDeck).toMatchObject({
        id: newDeck.id,
        name: updatedName,
        filters: {
          state: expect.arrayContaining(deckInput.filters.state),
          types: expect.arrayContaining(deckInput.filters.types),
          tags: expect.arrayContaining(deckInput.filters.tags),
        },
      });
    });

    it("updates the filters field", async () => {
      const newDeck = await decksTable.create.mutation({
        deck: { name: "test deck", filters: null },
      });

      const updatedFilters = {
        state: [FlashcardState.NEW],
        types: ["harf"],
        tags: ["bar"],
      } satisfies DeckFilters;

      const updatedDeck = await decksTable.update.mutation({
        id: newDeck.id,
        updates: { filters: updatedFilters },
      });

      expect(updatedDeck).toMatchObject({
        id: newDeck.id,
        name: "test deck",
        filters: {
          state: expect.arrayContaining(updatedFilters.state),
          types: expect.arrayContaining(updatedFilters.types),
          tags: expect.arrayContaining(updatedFilters.tags),
        },
      });
    });

    it("throws when no fields are provided", async () => {
      const newDeck = await decksTable.create.mutation({
        deck: { name: "test deck", filters: null },
      });

      await expect(
        decksTable.update.mutation({ id: newDeck.id, updates: {} })
      ).rejects.toThrow("No fields to update");
    });

    it("throws when the deck does not exist", async () => {
      await expect(
        decksTable.update.mutation({
          id: "not-a-real-id",
          updates: { name: "updated deck" },
        })
      ).rejects.toThrow("Deck not found");
    });
  });

  describe("delete", () => {
    it("removes the deck", async () => {
      const newDeck = await decksTable.create.mutation({
        deck: { name: "test deck", filters: null },
      });

      await expect(
        decksTable.delete.mutation({ id: newDeck.id })
      ).resolves.toMatchObject({ success: true });

      const deckExists = await (
        await testDb.db.prepare("SELECT * FROM decks WHERE id = ?")
      ).get([newDeck.id]);

      expect(deckExists).toBeUndefined();
    });

    it("does not throw when deleting a deck that doesn't exist", async () => {
      await expect(
        decksTable.delete.mutation({ id: "not-a-real-id" })
      ).resolves.toMatchObject({ success: true });
    });
  });

  describe("list", () => {
    describe("types filter", () => {
      it("counts only flashcards whose dictionary entry matches a specified type", async () => {
        const deck = await insertDeck(testDb, { filters: { types: ["ism"] } });

        const ismEntry = await insertDictionaryEntry(testDb, { type: "ism" });
        await insertFlashcard(testDb, { dictionary_entry_id: ismEntry.id });

        const filEntry = await insertDictionaryEntry(testDb, { type: "fi'l" });
        await insertFlashcard(testDb, { dictionary_entry_id: filEntry.id });

        const decks = await decksTable.list.query({});
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(1);
      });

      it("defaults to counting all word types when types is unset", async () => {
        const deck = await insertDeck(testDb, { filters: null });

        for (const type of ["ism", "fi'l", "harf", "expression"] as const) {
          const entry = await insertDictionaryEntry(testDb, { type });
          await insertFlashcard(testDb, { dictionary_entry_id: entry.id });
        }

        const decks = await decksTable.list.query({});
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(4);
      });
    });

    describe("state filter", () => {
      it("counts only flashcards in a specified FSRS state", async () => {
        const deck = await insertDeck(testDb, {
          filters: { state: [FlashcardState.NEW] },
        });

        await insertFlashcard(testDb, { state: FlashcardState.NEW });
        await insertFlashcard(testDb, { state: FlashcardState.REVIEW });

        const decks = await decksTable.list.query({});
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(1);
      });

      it("defaults to counting all states when state is unset", async () => {
        const deck = await insertDeck(testDb, { filters: null });

        await insertFlashcard(testDb, { state: FlashcardState.NEW });
        await insertFlashcard(testDb, { state: FlashcardState.LEARNING });
        await insertFlashcard(testDb, { state: FlashcardState.REVIEW });
        await insertFlashcard(testDb, { state: FlashcardState.RE_LEARNING });

        const decks = await decksTable.list.query({});
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(4);
      });
    });

    describe("tags filter", () => {
      it("counts only flashcards whose dictionary entry has a specified tag", async () => {
        const deck = await insertDeck(testDb, { filters: { tags: ["foo"] } });

        const fooEntry = await insertDictionaryEntry(testDb, { tags: ["foo"] });
        await insertFlashcard(testDb, { dictionary_entry_id: fooEntry.id });

        const barEntry = await insertDictionaryEntry(testDb, { tags: ["bar"] });
        await insertFlashcard(testDb, { dictionary_entry_id: barEntry.id });

        const decks = await decksTable.list.query({});
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(1);
      });

      it("does not restrict by tag when tags is unset", async () => {
        const deck = await insertDeck(testDb, { filters: null });

        const fooEntry = await insertDictionaryEntry(testDb, { tags: ["foo"] });
        await insertFlashcard(testDb, { dictionary_entry_id: fooEntry.id });

        const noTagEntry = await insertDictionaryEntry(testDb, { tags: null });
        await insertFlashcard(testDb, { dictionary_entry_id: noTagEntry.id });

        const decks = await decksTable.list.query({});
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(2);
      });

      it("matches an entry that has ANY of several specified tags (OR)", async () => {
        // Multi-tag filters are what surfaced the json_each perf bug; this
        // pins down the OR semantics of the tag subquery.
        const deck = await insertDeck(testDb, {
          filters: { tags: ["foo", "bar"] },
        });

        const fooEntry = await insertDictionaryEntry(testDb, { tags: ["foo"] });
        await insertFlashcard(testDb, { dictionary_entry_id: fooEntry.id });

        const barEntry = await insertDictionaryEntry(testDb, { tags: ["bar"] });
        await insertFlashcard(testDb, { dictionary_entry_id: barEntry.id });

        const bazEntry = await insertDictionaryEntry(testDb, { tags: ["baz"] });
        await insertFlashcard(testDb, { dictionary_entry_id: bazEntry.id });

        const decks = await decksTable.list.query({});
        // foo + bar match, baz does not.
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(2);
      });

      it("counts an entry with several matching tags only once", async () => {
        // Regression guard for the tag filter rewrite: the subquery joins
        // json_each(tags), so an entry matching multiple filter tags yields
        // its id more than once inside the IN (...) set. total_hits is
        // COUNT(DISTINCT flashcards.id), so the flashcard must still count once.
        const deck = await insertDeck(testDb, {
          filters: { tags: ["foo", "bar"] },
        });

        const bothEntry = await insertDictionaryEntry(testDb, {
          tags: ["foo", "bar"],
        });
        await insertFlashcard(testDb, { dictionary_entry_id: bothEntry.id });

        const decks = await decksTable.list.query({});
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(1);
      });

      it("matches an entry that has ANY of several specified tags (OR)", async () => {
        // Multi-tag filters are what surfaced the json_each perf bug; this
        // pins down the OR semantics of the tag subquery.
        const deck = await insertDeck(testDb, {
          filters: { tags: ["foo", "bar"] },
        });

        const fooEntry = await insertDictionaryEntry(testDb, { tags: ["foo"] });
        await insertFlashcard(testDb, { dictionary_entry_id: fooEntry.id });

        const barEntry = await insertDictionaryEntry(testDb, { tags: ["bar"] });
        await insertFlashcard(testDb, { dictionary_entry_id: barEntry.id });

        const bazEntry = await insertDictionaryEntry(testDb, { tags: ["baz"] });
        await insertFlashcard(testDb, { dictionary_entry_id: bazEntry.id });

        const decks = await decksTable.list.query({});
        const result = decks.find((d) => d.id === deck.id);

        // foo + bar match, baz does not.
        expect(result?.total_hits).toBe(2);
      });

      it("counts an entry with several matching tags only once", async () => {
        // Regression guard for the tag filter rewrite: the subquery joins
        // json_each(tags), so an entry matching multiple filter tags yields
        // its id more than once inside the IN (...) set. total_hits is
        // COUNT(DISTINCT flashcards.id), so the flashcard must still count once.
        const deck = await insertDeck(testDb, {
          filters: { tags: ["foo", "bar"] },
        });

        const bothEntry = await insertDictionaryEntry(testDb, {
          tags: ["foo", "bar"],
        });
        await insertFlashcard(testDb, { dictionary_entry_id: bothEntry.id });

        const decks = await decksTable.list.query({});
        const result = decks.find((d) => d.id === deck.id);

        expect(result?.total_hits).toBe(1);
      });
    });

    describe("show_reverse", () => {
      it("excludes reverse-direction flashcards when show_reverse is false", async () => {
        const deck = await insertDeck(testDb, { filters: null });

        await insertFlashcard(testDb, { direction: "forward" });
        await insertFlashcard(testDb, { direction: "reverse" });

        const decks = await decksTable.list.query({ show_reverse: false });
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(1);
      });

      it("includes reverse-direction flashcards when show_reverse is true", async () => {
        const deck = await insertDeck(testDb, { filters: null });

        await insertFlashcard(testDb, { direction: "forward" });
        await insertFlashcard(testDb, { direction: "reverse" });

        const decks = await decksTable.list.query({ show_reverse: true });
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(2);
      });
    });

    describe("combined filters", () => {
      it("applies type, state, tags, and show_reverse filters together", async () => {
        const deck = await insertDeck(testDb, {
          filters: {
            types: ["ism"],
            state: [FlashcardState.NEW],
            tags: ["foo"],
          },
        });

        // Fully matching.
        const matchEntry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["foo"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: matchEntry.id,
          state: FlashcardState.NEW,
          direction: "forward",
        });

        // Wrong type.
        const wrongTypeEntry = await insertDictionaryEntry(testDb, {
          type: "fi'l",
          tags: ["foo"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: wrongTypeEntry.id,
          state: FlashcardState.NEW,
          direction: "forward",
        });

        // Wrong state.
        const wrongStateEntry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["foo"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: wrongStateEntry.id,
          state: FlashcardState.REVIEW,
          direction: "forward",
        });

        // Wrong tag.
        const wrongTagEntry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["bar"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: wrongTagEntry.id,
          state: FlashcardState.NEW,
          direction: "forward",
        });

        // Reverse direction, excluded since show_reverse is false.
        const reverseEntry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["foo"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: reverseEntry.id,
          state: FlashcardState.NEW,
          direction: "reverse",
        });

        const decks = await decksTable.list.query({ show_reverse: false });
        expect(decks.find((d) => d.id === deck.id)?.total_hits).toBe(1);
      });
    });

    describe("hidden flashcards", () => {
      it("excludes hidden flashcards from counts regardless of other filters", async () => {
        const deck = await insertDeck(testDb, {
          filters: {
            types: ["ism"],
            state: [FlashcardState.NEW],
            tags: ["foo"],
          },
        });

        const entry = await insertDictionaryEntry(testDb, {
          type: "ism",
          tags: ["foo"],
        });
        await insertFlashcard(testDb, {
          dictionary_entry_id: entry.id,
          state: FlashcardState.NEW,
          is_hidden: true,
        });

        const decks = await decksTable.list.query({});
        const result = decks.find((d) => d.id === deck.id);

        expect(result?.total_hits).toBe(0);
        expect(result?.to_review).toBe(0);
        expect(result?.to_review_backlog).toBe(0);
      });
    });

    describe("due-date windowing", () => {
      it("excludes not-yet-due flashcards from to_review/to_review_backlog, but total_hits still counts them", async () => {
        // total_hits is COUNT(DISTINCT f.id) with no due-date condition --
        // only to_review/to_review_backlog filter by due date.
        const deck = await insertDeck(testDb, { filters: null });

        const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2);
        await insertFlashcard(testDb, {
          due: futureDate.toISOString(),
          due_timestamp_ms: futureDate.getTime(),
        });

        const decks = await decksTable.list.query({});
        const result = decks.find((d) => d.id === deck.id);

        expect(result?.to_review).toBe(0);
        expect(result?.to_review_backlog).toBe(0);
        expect(result?.total_hits).toBe(1);
      });

      it("splits due flashcards between to_review and to_review_backlog by backlogThresholdDays", async () => {
        const deck = await insertDeck(testDb, { filters: null });
        const backlogThresholdDays = 7;

        // Due 1 day ago: within threshold -> to_review.
        const recentlyDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1);
        await insertFlashcard(testDb, {
          due: recentlyDueDate.toISOString(),
          due_timestamp_ms: recentlyDueDate.getTime(),
        });

        // Due 10 days ago: past threshold -> to_review_backlog.
        const oldDueDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
        await insertFlashcard(testDb, {
          due: oldDueDate.toISOString(),
          due_timestamp_ms: oldDueDate.getTime(),
        });

        const decks = await decksTable.list.query({ backlogThresholdDays });
        const result = decks.find((d) => d.id === deck.id);

        expect(result?.to_review).toBe(1);
        expect(result?.to_review_backlog).toBe(1);
        expect(result?.total_hits).toBe(2);
      });
    });
  });

  describe("get", () => {
    it("returns the deck by id", async () => {
      const deck = await insertDeck(testDb, { name: "My Deck" });

      expect(await decksTable.get.query({ id: deck.id })).toMatchObject({
        id: deck.id,
        name: "My Deck",
      });
    });

    it("returns null when the deck does not exist", async () => {
      expect(await decksTable.get.query({ id: "not-a-real-id" })).toBeNull();
    });
  });
});
