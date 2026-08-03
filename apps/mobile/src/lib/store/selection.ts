import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";

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

/**
 * Resolver for every id matching the current search, published by the list
 * (which owns the query) for the selection header (which doesn't). "Select all"
 * has to mean all results, not just the pages loaded so far.
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

  /**
   * Flips one entry, and leaves selection mode when that empties the selection.
   *
   * A long press enters the mode and selects the entry in one gesture, so
   * unpicking it should undo the whole thing rather than leave an empty mode
   * running. Entering deliberately from the header button has nothing to unpick,
   * so it stays -- one rule, no need to remember how the mode started.
   *
   * Clearing from the action bar deliberately does not exit: that button means
   * "empty the selection", while the bar's ✕ means "leave".
   */
  const toggle = useCallback(
    (id: string) => {
      const next = toggleId(selectedIds, id);

      setSelectedIds(next);

      if (next.size === 0) {
        setSelectionMode(false);
      }
    },
    [selectedIds, setSelectedIds, setSelectionMode]
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

  /**
   * Takes every word matching the current search and filters, not just the ones
   * loaded so far -- the count on screen is what the user is reading, so that is
   * what "select all" has to mean.
   */
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(resolveAllMatchingIds?.() ?? []));
  }, [resolveAllMatchingIds, setSelectedIds]);

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
