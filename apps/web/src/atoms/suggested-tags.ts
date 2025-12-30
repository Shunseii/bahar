import { atomWithStorage } from "jotai/utils";

export const suggestedTagsAtom = atomWithStorage<string[]>(
  "suggested-tags",
  [],
  {
    getItem: (key) => {
      const val = sessionStorage.getItem(key);
      return val ? JSON.parse(val) : [];
    },
    setItem: (key, val) => {
      sessionStorage.setItem(key, JSON.stringify(val));
    },
    removeItem: (key) => sessionStorage.removeItem(key),
  }
);
