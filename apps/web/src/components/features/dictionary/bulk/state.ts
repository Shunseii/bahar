import { atom, useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";

/**
 * Whether the dictionary list is in bulk-selection mode. Entering it swaps the
 * per-card actions for a checkbox and makes the whole card a select target, so
 * it has to be an explicit mode rather than something a stray click can start.
 */
const selectionModeAtom = atom(false);

/**
 * Ids of the selected entries. Replaced (never mutated) on every change so
 * memoized card rows re-render off an identity check.
 */
const selectedIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

export const useBulkSelection = () => {
  const [selectionMode, setSelectionMode] = useAtom(selectionModeAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [setSelectionMode, setSelectedIds]);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, [setSelectionMode]);

  const toggle = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (!next.delete(id)) {
          next.add(id);
        }

        return next;
      });
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

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    enterSelectionMode,
    exitSelectionMode,
    toggle,
    selectAll,
    clear,
  };
};

/**
 * Read-only view for the card rows, which only need to know whether the mode is
 * on and which ids are in it.
 */
export const useBulkSelectionState = () => ({
  selectionMode: useAtomValue(selectionModeAtom),
  selectedIds: useAtomValue(selectedIdsAtom),
});
