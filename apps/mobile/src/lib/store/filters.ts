import type { WordType } from "@bahar/drizzle-user-db-schemas";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import type { SortOption } from "@/hooks/useSearch";

const FILTERS_STORAGE_KEY_PREFIX = "bahar:filters";

const selectedTagsStorageAtom = atomWithStorage(
  `${FILTERS_STORAGE_KEY_PREFIX}:selectedTags`,
  [] as string[],
  createJSONStorage<string[]>(() => AsyncStorage),
  { getOnInit: true }
);

const selectedTypesStorageAtom = atomWithStorage(
  `${FILTERS_STORAGE_KEY_PREFIX}:selectedTypes`,
  [] as WordType[],
  createJSONStorage<WordType[]>(() => AsyncStorage),
  { getOnInit: true }
);

const sortOptionStorageAtom = atomWithStorage(
  `${FILTERS_STORAGE_KEY_PREFIX}:sortOption`,
  "relevance",
  createJSONStorage<SortOption>(() => AsyncStorage),
  { getOnInit: true }
);

export const selectedTagsAtom = atom(
  (get) => {
    const val = get(selectedTagsStorageAtom);
    return Array.isArray(val) ? val : [];
  },
  (_get, set, update: string[] | ((prev: string[]) => string[])) => {
    const current = _get(selectedTagsStorageAtom);
    const resolved = Array.isArray(current) ? current : [];
    const next = typeof update === "function" ? update(resolved) : update;
    set(selectedTagsStorageAtom, next);
  }
);

export const selectedTypesAtom = atom(
  (get) => {
    const val = get(selectedTypesStorageAtom);
    return Array.isArray(val) ? val : [];
  },
  (_get, set, update: WordType[] | ((prev: WordType[]) => WordType[])) => {
    const current = _get(selectedTypesStorageAtom);
    const resolved = Array.isArray(current) ? current : [];
    const next = typeof update === "function" ? update(resolved) : update;
    set(selectedTypesStorageAtom, next);
  }
);

export const sortOptionAtom = atom(
  (get) => {
    const val = get(sortOptionStorageAtom);
    return typeof val === "string" ? (val as SortOption) : "relevance";
  },
  (_get, set, update: SortOption) => {
    set(sortOptionStorageAtom, update);
  }
);

export const activeFilterCountAtom = atom((get) => {
  const tags = get(selectedTagsAtom);
  const types = get(selectedTypesAtom);
  const sort = get(sortOptionAtom);
  let count = 0;
  if (tags.length > 0) count++;
  if (types.length > 0) count++;
  if (sort !== "relevance") count++;
  return count;
});
