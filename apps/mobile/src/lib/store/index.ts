import AsyncStorage from "@react-native-async-storage/async-storage";
import { atom, createStore } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

export const store = createStore();

export const syncCompletedCountAtom = atom(0);

export const isSyncingAtom = atom(false);

export const dictionaryChangedAtom = atom(false);

/**
 * Set when a flashcard is graded so the dictionary list refreshes its Orama
 * results the next time it regains focus. Grading updates the search index doc
 * directly; this defers the (sorted, full-index) re-search to when the list is
 * actually visible instead of running it off-screen on every grade.
 */
export const reviewsPendingRefreshAtom = atom(false);

export const recentTagsAtom = atomWithStorage(
  "bahar:recentTags",
  [] as string[],
  createJSONStorage<string[]>(() => AsyncStorage),
  { getOnInit: true }
);

export const createMultipleAtom = atomWithStorage(
  "bahar:createMultiple",
  false,
  createJSONStorage<boolean>(() => AsyncStorage),
  { getOnInit: true }
);
