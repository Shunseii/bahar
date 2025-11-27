import { atom } from "jotai";

/**
 * Count of the number of records skipped during
 * indexing in Orama.
 *
 * The purpose of this is to display a warning
 * to the user of how many records failed to
 * index.
 */
export const hydrationSkippedCountAtom = atom(0);
