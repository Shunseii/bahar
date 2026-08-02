import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";

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

/**
 * Resolver for every id matching the current search, published by the list
 * (which owns the query) for the selection bar (which doesn't). "Select all"
 * has to mean all results, not just the pages infinite scroll happens to have
 * loaded, and the two components sit in different subtrees.
 */
const allMatchingIdsAtom = atom<(() => string[]) | null>(null);

export const usePublishAllMatchingIds = (resolver: () => string[]) => {
  const setResolver = useSetAtom(allMatchingIdsAtom);

  useEffect(() => {
    setResolver(() => resolver);

    return () => setResolver(null);
  }, [resolver, setResolver]);
};

export const useBulkSelection = () => {
  const [selectionMode, setSelectionMode] = useAtom(selectionModeAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
  const resolveAllMatchingIds = useAtomValue(allMatchingIdsAtom);

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

  /**
   * Takes every word matching the current search and filters, not just the ones
   * infinite scroll has loaded -- the count on screen is what the user is
   * reading, so that is what "select all" has to mean.
   */
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(resolveAllMatchingIds?.() ?? []));
  }, [resolveAllMatchingIds, setSelectedIds]);

  /**
   * Adds a run of ids without unselecting anything, for shift-click range
   * selection: extending a range shouldn't drop what's already picked.
   */
  const addRange = useCallback(
    (ids: string[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        for (const id of ids) {
          next.add(id);
        }

        return next;
      });
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
    addRange,
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
