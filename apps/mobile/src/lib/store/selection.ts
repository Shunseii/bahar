import { atom, useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";

/**
 * Whether the dictionary list is in bulk-selection mode. Entered by long-pressing
 * a word: while it's on, tapping a card selects it instead of expanding it.
 */
const selectionModeAtom = atom(false);

/**
 * Ids of the selected entries. Replaced (never mutated) on every change so the
 * list's `extraData` identity check re-renders the rows.
 */
const selectedIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

/**
 * Flips an id's membership, returning a new set.
 */
export const toggleId = (
  ids: ReadonlySet<string>,
  id: string
): ReadonlySet<string> => {
  const next = new Set(ids);

  if (!next.delete(id)) {
    next.add(id);
  }

  return next;
};

/**
 * Adds an id, returning the same set when it's already selected. Identity is
 * the signal for "nothing changed" -- it keeps a drag that re-crosses a row from
 * re-rendering the list and from firing another haptic tick.
 */
export const addId = (
  ids: ReadonlySet<string>,
  id: string
): ReadonlySet<string> => {
  if (ids.has(id)) return ids;

  const next = new Set(ids);
  next.add(id);

  return next;
};

export const useBulkSelection = () => {
  const [selectionMode, setSelectionMode] = useAtom(selectionModeAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [setSelectionMode, setSelectedIds]);

  const toggle = useCallback(
    (id: string) => {
      setSelectedIds((prev) => toggleId(prev, id));
    },
    [setSelectedIds]
  );

  /**
   * Replaces the whole selection. Drag-select computes each frame's selection
   * from the snapshot it took when the drag began, so it needs to set the
   * result outright rather than nudge the current one.
   */
  const setSelection = useCallback(
    (ids: ReadonlySet<string>) => {
      setSelectedIds(ids);
    },
    [setSelectedIds]
  );

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, [setSelectionMode]);

  const selectAll = useCallback(
    (ids: string[]) => {
      setSelectedIds(new Set(ids));
    },
    [setSelectedIds]
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    enterSelectionMode,
    exitSelectionMode,
    toggle,
    setSelection,
    selectAll,
    clear,
  };
};

export const useSelectionMode = () => useAtomValue(selectionModeAtom);
