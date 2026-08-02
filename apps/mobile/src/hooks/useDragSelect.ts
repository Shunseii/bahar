import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import type { View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

/**
 * How long a finger has to rest on a word before the drag takes over. Below
 * ~250ms the list starts eating scroll flicks; above ~450ms the long press
 * stops feeling connected to the press.
 */
const LONG_PRESS_DURATION_MS = 300;

/** Distance from the list's edge at which a drag starts auto-scrolling. */
const AUTO_SCROLL_EDGE = 90;

/** Pixels per tick while auto-scrolling, and how often a tick runs. */
const AUTO_SCROLL_STEP = 12;
const AUTO_SCROLL_INTERVAL_MS = 16;

/**
 * How often row positions are re-measured while auto-scrolling. Rows move under
 * a stationary finger, so the map from screen position to row goes stale; this
 * is a compromise between a stale hit-test and measuring every frame.
 */
const REMEASURE_INTERVAL_MS = 100;

export interface RowRect {
  id: string;
  top: number;
  bottom: number;
}

/**
 * The row the finger is over, in window coordinates. Rows are laid out with a
 * gap between them, so a position in that gap belongs to no row and the drag
 * keeps whatever it last resolved.
 */
export const rowAtPosition = ({
  rects,
  absoluteY,
}: {
  rects: RowRect[];
  absoluteY: number;
}): RowRect | undefined =>
  rects.find((rect) => absoluteY >= rect.top && absoluteY <= rect.bottom);

/**
 * The ids a drag covers: everything between the row it started on and the row
 * the finger is over now, in list order.
 */
export const idsInRange = ({
  orderedIds,
  anchorId,
  currentId,
}: {
  orderedIds: string[];
  anchorId: string;
  currentId: string;
}): string[] => {
  const anchorIndex = orderedIds.indexOf(anchorId);
  const currentIndex = orderedIds.indexOf(currentId);

  if (anchorIndex === -1 || currentIndex === -1) return [];

  const [start, end] =
    anchorIndex <= currentIndex
      ? [anchorIndex, currentIndex]
      : [currentIndex, anchorIndex];

  return orderedIds.slice(start, end + 1);
};

/**
 * The selection a drag produces: the range applied over the selection as it was
 * when the drag began. Computing from that snapshot rather than from the live
 * selection is what lets a drag be undone by dragging back -- rows outside the
 * current range return to their original state instead of staying stuck.
 */
export const applyDragRange = ({
  snapshot,
  rangeIds,
  mode,
}: {
  snapshot: ReadonlySet<string>;
  rangeIds: string[];
  mode: "select" | "deselect";
}): ReadonlySet<string> => {
  const next = new Set(snapshot);

  for (const id of rangeIds) {
    if (mode === "select") {
      next.add(id);
    } else {
      next.delete(id);
    }
  }

  return next;
};

interface UseDragSelectOptions {
  /** Ids in list order, used to turn an anchor + current row into a range. */
  orderedIds: string[];
  getSelectedIds: () => ReadonlySet<string>;
  setSelection: (ids: ReadonlySet<string>) => void;
  enterSelectionMode: () => void;
  getScrollOffset: () => number;
  scrollToOffset: (offset: number) => void;
}

/**
 * Long-press-then-drag selection for the dictionary list, following the pattern
 * iOS Photos and Google Photos use:
 *
 * - the long-pressed row is the anchor, and its state before the press decides
 *   the mode: unselected anchor means the drag selects, already-selected anchor
 *   means it deselects;
 * - the affected set is always the range between anchor and finger, so dragging
 *   back over rows unwinds them;
 * - dragging into the top or bottom edge auto-scrolls and keeps extending.
 *
 * Rows are hit-tested against window coordinates measured when the gesture
 * activates, re-measured while auto-scrolling (when rows move under the
 * finger). A pan that has activated owns the touch, so the list can't scroll on
 * its own underneath the measurement.
 */
export const useDragSelect = ({
  orderedIds,
  getSelectedIds,
  setSelection,
  enterSelectionMode,
  getScrollOffset,
  scrollToOffset,
}: UseDragSelectOptions) => {
  const rowRefs = useRef(new Map<string, View>());
  const listRef = useRef<View | null>(null);
  const rectsRef = useRef<RowRect[]>([]);
  const listRectRef = useRef<{ top: number; bottom: number } | null>(null);

  const dragRef = useRef<{
    anchorId: string;
    mode: "select" | "deselect";
    snapshot: ReadonlySet<string>;
    lastRowId: string;
    lastY: number;
  } | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderedIdsRef = useRef(orderedIds);
  orderedIdsRef.current = orderedIds;

  const registerRow = useCallback((id: string, node: View | null) => {
    if (node) {
      rowRefs.current.set(id, node);
    } else {
      rowRefs.current.delete(id);
    }
  }, []);

  const registerList = useCallback((node: View | null) => {
    listRef.current = node;
  }, []);

  const measureRows = useCallback(
    () =>
      Promise.all(
        [...rowRefs.current.entries()].map(
          ([id, node]) =>
            new Promise<RowRect | null>((resolve) => {
              node.measureInWindow((_x, y, _width, height) => {
                // A row that is unmounted or not yet laid out measures as
                // zero-height; keeping it would put a hit target at the top of
                // the screen.
                resolve(height ? { id, top: y, bottom: y + height } : null);
              });
            })
        )
      ).then((rects) => rects.filter((rect): rect is RowRect => rect !== null)),
    []
  );

  const measureList = useCallback(
    () =>
      new Promise<{ top: number; bottom: number } | null>((resolve) => {
        const node = listRef.current;

        if (!node) {
          resolve(null);
          return;
        }

        node.measureInWindow((_x, y, _width, height) => {
          resolve(height ? { top: y, bottom: y + height } : null);
        });
      }),
    []
  );

  const applyAt = useCallback(
    (absoluteY: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      const row = rowAtPosition({ rects: rectsRef.current, absoluteY });
      if (!row || row.id === drag.lastRowId) return;

      drag.lastRowId = row.id;

      setSelection(
        applyDragRange({
          snapshot: drag.snapshot,
          rangeIds: idsInRange({
            orderedIds: orderedIdsRef.current,
            anchorId: drag.anchorId,
            currentId: row.id,
          }),
          mode: drag.mode,
        })
      );
      Haptics.selectionAsync();
    },
    [setSelection]
  );

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const updateAutoScroll = useCallback(
    (absoluteY: number) => {
      const listRect = listRectRef.current;
      if (!listRect) return;

      const direction =
        absoluteY > listRect.bottom - AUTO_SCROLL_EDGE
          ? 1
          : absoluteY < listRect.top + AUTO_SCROLL_EDGE
            ? -1
            : 0;

      if (direction === 0) {
        stopAutoScroll();
        return;
      }

      if (autoScrollRef.current) return;

      let sinceMeasure = 0;

      autoScrollRef.current = setInterval(() => {
        const drag = dragRef.current;
        if (!drag) {
          stopAutoScroll();
          return;
        }

        scrollToOffset(
          Math.max(0, getScrollOffset() + direction * AUTO_SCROLL_STEP)
        );

        sinceMeasure += AUTO_SCROLL_INTERVAL_MS;

        if (sinceMeasure >= REMEASURE_INTERVAL_MS) {
          sinceMeasure = 0;
          measureRows().then((rects) => {
            rectsRef.current = rects;
            applyAt(drag.lastY);
          });
        }
      }, AUTO_SCROLL_INTERVAL_MS);
    },
    [applyAt, getScrollOffset, measureRows, scrollToOffset, stopAutoScroll]
  );

  const handleDragStart = useCallback(
    async (absoluteY: number) => {
      const [rects, listRect] = await Promise.all([
        measureRows(),
        measureList(),
      ]);

      rectsRef.current = rects;
      listRectRef.current = listRect;

      const row = rowAtPosition({ rects, absoluteY });
      if (!row) return;

      const snapshot = getSelectedIds();
      const mode = snapshot.has(row.id) ? "deselect" : "select";

      dragRef.current = {
        anchorId: row.id,
        mode,
        snapshot,
        // Empty so the first applyAt below isn't skipped as a repeat.
        lastRowId: "",
        lastY: absoluteY,
      };

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      enterSelectionMode();
      applyAt(absoluteY);
    },
    [applyAt, enterSelectionMode, getSelectedIds, measureList, measureRows]
  );

  const handleDragMove = useCallback(
    (absoluteY: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      drag.lastY = absoluteY;
      applyAt(absoluteY);
      updateAutoScroll(absoluteY);
    },
    [applyAt, updateAutoScroll]
  );

  const handleDragEnd = useCallback(() => {
    stopAutoScroll();
    dragRef.current = null;
    rectsRef.current = [];
    listRectRef.current = null;
  }, [stopAutoScroll]);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_DURATION_MS)
    .onStart((event) => {
      runOnJS(handleDragStart)(event.absoluteY);
    })
    .onUpdate((event) => {
      runOnJS(handleDragMove)(event.absoluteY);
    })
    .onFinalize(() => {
      runOnJS(handleDragEnd)();
    });

  return { gesture, registerRow, registerList };
};
