import { atom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

/**
 * How many bottom sheets are currently presented.
 *
 * @gorhom/bottom-sheet doesn't register a hardware back handler of its own, so
 * back has to know whether a sheet is up before it decides what to do. The
 * sheets are also mounted permanently alongside the action bar, which is why
 * this tracks presentation rather than mounting.
 */
const openSheetCountAtom = atom(0);

export const useOpenSheetCount = () => useAtomValue(openSheetCountAtom);

/**
 * Reports a sheet's presented state into the shared count for as long as it's
 * open.
 */
export const useTrackSheetOpen = (isOpen: boolean) => {
  const setCount = useSetAtom(openSheetCountAtom);

  useEffect(() => {
    if (!isOpen) return;

    setCount((count) => count + 1);

    return () => setCount((count) => Math.max(0, count - 1));
  }, [isOpen, setCount]);
};
