import AsyncStorage from "@react-native-async-storage/async-storage";
import { atom, createStore } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

export const store = createStore();

export const syncCompletedCountAtom = atom(0);

export const isSyncingAtom = atom(false);

export const dictionaryChangedAtom = atom(false);

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

/**
 * Whether local review-reminder notifications are enabled. Device-only
 * preference; the OS permission is requested separately when this is turned on.
 */
export const notificationsEnabledAtom = atomWithStorage(
  "bahar:notificationsEnabled",
  false,
  createJSONStorage<boolean>(() => AsyncStorage),
  { getOnInit: true }
);
