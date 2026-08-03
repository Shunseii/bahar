import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";

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

/**
 * How a selection lines up with the ids the current search returns.
 *
 * Split out from the hooks because this is the part that was wrong before: a
 * selection outlives the search that produced it, so comparing its size against
 * the result count claimed "everything is selected" whenever the selection was
 * merely larger than the result set.
 */
export const describeSelectionScope = ({
  selectedIds,
  matchingIds,
}: {
  selectedIds: ReadonlySet<string>;
  matchingIds: ReadonlySet<string>;
}) => {
  let selectedInResults = 0;

  for (const id of selectedIds) {
    if (matchingIds.has(id)) selectedInResults++;
  }

  return {
    matchingCount: matchingIds.size,
    /** Selected words the current search doesn't return. */
    outsideResultsCount: selectedIds.size - selectedInResults,
    allSelected: matchingIds.size > 0 && selectedInResults === matchingIds.size,
  };
};

/**
 * How the selection lines up with the results currently on screen.
 *
 * A selection outlives the search that produced it -- picking words under one
 * query, narrowing to another, and picking more before tagging the lot is a
 * real way to work -- so the two can drift apart. That makes the raw selected
 * count a poor answer to "is everything selected?" (50 selected against 3
 * results is not "all"), and it makes an action's reach worth stating outright,
 * since the words it will touch may not be the ones being looked at.
 */
export const useSelectionScope = () => {
  const selectedIds = useAtomValue(selectedIdsAtom);
  const resolveAllMatchingIds = useAtomValue(allMatchingIdsAtom);

  // The resolver's identity changes with the query, so the matching set is
  // recomputed per search rather than per render.
  const matchingIds = useMemo(
    () => new Set(resolveAllMatchingIds?.() ?? []),
    [resolveAllMatchingIds]
  );

  return describeSelectionScope({ selectedIds, matchingIds });
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

  /**
   * Flips one entry, and leaves selection mode when that empties the selection,
   * matching mobile. Clearing from the bar deliberately does not exit: that
   * button means "empty the selection", the ✕ means "leave".
   */
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);

      if (!next.delete(id)) {
        next.add(id);
      }

      setSelectedIds(next);

      if (next.size === 0) {
        setSelectionMode(false);
      }
    },
    [selectedIds, setSelectedIds, setSelectionMode]
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
