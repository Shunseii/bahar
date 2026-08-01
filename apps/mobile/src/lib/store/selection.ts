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
   * Selects an id without unselecting it if it's already in the selection --
   * what a drag across the list needs, where crossing a row twice (or wobbling
   * over its edge) must not flip it back off. Reports whether it added anything
   * so the caller can tie feedback to real changes.
   */
  const add = useCallback(
    (id: string) => {
      let added = false;

      setSelectedIds((prev) => {
        const next = addId(prev, id);
        added = next !== prev;

        return next;
      });

      return added;
    },
    [setSelectedIds]
  );

  const selectAll = useCallback(
    (ids: string[]) => {
      setSelectedIds(new Set(ids));
    },
    [setSelectedIds]
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  const startSelection = useCallback(
    (id: string) => {
      setSelectionMode(true);
      setSelectedIds((prev) => addId(prev, id));
    },
    [setSelectionMode, setSelectedIds]
  );

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    startSelection,
    exitSelectionMode,
    toggle,
    add,
    selectAll,
    clear,
  };
};

export const useSelectionMode = () => useAtomValue(selectionModeAtom);
