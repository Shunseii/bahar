import {
  decks,
  dictionaryEntries,
  FlashcardState,
  flashcards,
  type InsertDeck,
  type InsertDictionaryEntry,
  type InsertFlashcard,
  type InsertSetting,
  type SelectDeck,
  type SelectDictionaryEntry,
  type SelectFlashcard,
  type SelectSetting,
  settings,
  WORD_TYPES,
} from "@bahar/drizzle-user-db-schemas";
import { nanoid } from "nanoid";
import type { TestDb } from "./create-test-db";

export const insertDeck = async (
  testDb: TestDb,
  overrides: Partial<InsertDeck> = {}
): Promise<SelectDeck> => {
  const [deck] = await testDb.drizzleDb
    .insert(decks)
    .values({
      id: nanoid(),
      name: "Test Deck",
      filters: null,
      ...overrides,
    })
    .returning();

  return deck;
};

export const insertDictionaryEntry = async (
  testDb: TestDb,
  overrides: Partial<InsertDictionaryEntry> = {}
): Promise<SelectDictionaryEntry> => {
  const now = new Date();

  const [entry] = await testDb.drizzleDb
    .insert(dictionaryEntries)
    .values({
      id: nanoid(),
      word: "كتاب",
      translation: "book",
      type: WORD_TYPES[0],
      created_at: now.toISOString(),
      created_at_timestamp_ms: now.getTime(),
      updated_at: now.toISOString(),
      updated_at_timestamp_ms: now.getTime(),
      ...overrides,
    })
    .returning();

  return entry;
};

export const insertFlashcard = async (
  testDb: TestDb,
  overrides: Partial<InsertFlashcard> = {}
): Promise<SelectFlashcard> => {
  const now = new Date();

  const [flashcard] = await testDb.drizzleDb
    .insert(flashcards)
    .values({
      id: nanoid(),
      dictionary_entry_id:
        overrides.dictionary_entry_id ??
        (await insertDictionaryEntry(testDb)).id,
      due: now.toISOString(),
      due_timestamp_ms: now.getTime(),
      direction: "forward",
      is_hidden: false,
      state: FlashcardState.NEW,
      ...overrides,
    })
    .returning();

  return flashcard;
};

export const insertSettings = async (
  testDb: TestDb,
  overrides: Partial<InsertSetting> = {}
): Promise<SelectSetting> => {
  const [setting] = await testDb.drizzleDb
    .insert(settings)
    .values({
      id: nanoid(),
      show_antonyms_in_flashcard: "hidden",
      create_reverse_by_default: false,
      ...overrides,
    })
    .returning();

  return setting;
};
