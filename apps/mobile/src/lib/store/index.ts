import AsyncStorage from "@react-native-async-storage/async-storage";
import { atom, createStore } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

export const store = createStore();

export const syncCompletedCountAtom = atom(0);

export const isSyncingAtom = atom(false);

export const recentTagsAtom = atomWithStorage(
  "bahar:recentTags",
  [] as string[],
  createJSONStorage<string[]>(() => AsyncStorage),
  { getOnInit: true }
);
