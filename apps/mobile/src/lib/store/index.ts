import { createStore, atom } from "jotai";

export const store = createStore();

export const syncCompletedCountAtom = atom(0);

export const isSyncingAtom = atom(false);
