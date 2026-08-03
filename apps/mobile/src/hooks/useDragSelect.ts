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

/**
 * How far from the usable edge of the list a drag starts auto-scrolling. Applied
 * above the floating action bar at the bottom (see bottomInset), so the zone is
 * somewhere the finger can actually sit.
 */
const AUTO_SCROLL_EDGE = 120;

/**
 * How fast the finger has to be moving toward an edge to start auto-scrolling,
 * in points per second. Position alone isn't enough: a thumb resting near the
 * bottom of the screen is a normal way to hold the phone, and creeping the list
 * from under it is not what the user asked for. Once scrolling has started,
 * staying in the zone keeps it going.
 */
const AUTO_SCROLL_MIN_VELOCITY = 120;

/**
 * Auto-scroll speed in points per second, at the near and far side of the edge
 * zone. Ramped between the two by how deep the finger is.
 */
const AUTO_SCROLL_MIN_SPEED = 120;
const AUTO_SCROLL_MAX_SPEED = 600;

/**
 * How far the target offset may run ahead of where the list actually is. Without
 * a cap it keeps accumulating once the list has hit its end, and the drag then
 * has to unwind all of it before scrolling back the other way.
 */
const AUTO_SCROLL_MAX_LEAD = 120;

/**
 * How often rows are re-measured while auto-scrolling. Scrolling itself no
 * longer invalidates the measurements -- they're corrected by how far the list
 * has moved (see rowAtPosition's offsetDelta) -- so this only needs to be often
 * enough to pick up rows that have newly mounted.
 */
const REMEASURE_INTERVAL_MS = 250;

export interface RowRect {
  id: string;
  top: number;
  bottom: number;
}

/**
 * The row the finger is over, in window coordinates. Rows are laid out with a
 * gap between them, so a position in that gap belongs to no row and the drag
 * keeps whatever it last resolved.
 *
 * `offsetDelta` is how far the list has scrolled since the rects were measured.
 * Auto-scrolling moves every row by exactly that much, so correcting the finger
 * position by it keeps the hit-test exact between measurements -- re-measuring
 * on a timer instead meant that at speed the resolved row lagged the finger and
 * the selection stopped short of the rows that had already gone past.
 */
export const rowAtPosition = ({
  rects,
  absoluteY,
  offsetDelta = 0,
}: {
  rects: RowRect[];
  absoluteY: number;
  offsetDelta?: number;
}): RowRect | undefined => {
  const y = absoluteY + offsetDelta;

  return rects.find((rect) => y >= rect.top && y <= rect.bottom);
};

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

/**
 * Which way a drag should auto-scroll, if at all: -1 up, 1 down, 0 not at all.
 *
 * Entering an edge zone is necessary but not sufficient -- the finger also has
 * to be moving that way. A drag already scrolling keeps going while the finger
 * rests in the zone, so the user can park there and let the list come to them,
 * but pulling back against the scroll stops it: that is how you ask it to stop
 * without lifting your finger and losing the drag.
 */
export const nextAutoScrollDirection = ({
  absoluteY,
  velocityY,
  listTop,
  listBottom,
  bottomInset,
  edge,
  isScrolling,
}: {
  absoluteY: number;
  velocityY: number;
  listTop: number;
  listBottom: number;
  bottomInset: number;
  edge: number;
  isScrolling: boolean;
}): -1 | 0 | 1 => {
  const inBottomZone = absoluteY > listBottom - bottomInset - edge;
  const inTopZone = absoluteY < listTop + edge;
  const direction = inBottomZone ? 1 : inTopZone ? -1 : 0;

  if (direction === 0) return 0;

  const isDeliberate = Math.abs(velocityY) >= AUTO_SCROLL_MIN_VELOCITY;
  const movingWithEdge = Math.sign(velocityY) === direction;

  // Already scrolling: carry on unless the finger is pulling the other way.
  // Small jitter from a resting finger is below the threshold and ignored.
  if (isScrolling) {
    return isDeliberate && !movingWithEdge ? 0 : direction;
  }

  return isDeliberate && movingWithEdge ? direction : 0;
};

interface UseDragSelectOptions {
  /** Ids in list order, used to turn an anchor + current row into a range. */
  orderedIds: string[];
  /**
   * Space at the bottom of the list covered by something else -- the floating
   * action bar. Auto-scroll has to start above it, or the trigger zone sits
   * under the panel where the finger can't usefully reach.
   */
  bottomInset?: number;
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
 * - dragging into the top or bottom edge auto-scrolls and keeps extending, but
 *   only once the finger is actually moving that way, so a resting thumb near an
 *   edge doesn't drag the list along with it.
 *
 * Rows are hit-tested against window coordinates measured when the gesture
 * activates, re-measured while auto-scrolling (when rows move under the
 * finger). A pan that has activated owns the touch, so the list can't scroll on
 * its own underneath the measurement.
 */
export const useDragSelect = ({
  orderedIds,
  bottomInset = 0,
  getSelectedIds,
  setSelection,
  enterSelectionMode,
  getScrollOffset,
  scrollToOffset,
}: UseDragSelectOptions) => {
  const rowRefs = useRef(new Map<string, View>());
  const listRef = useRef<View | null>(null);
  const rectsRef = useRef<RowRect[]>([]);
  /** Scroll offset the rects were measured at, for correcting them since. */
  const rectsOffsetRef = useRef(0);
  const listRectRef = useRef<{ top: number; bottom: number } | null>(null);

  const dragRef = useRef<{
    anchorId: string;
    mode: "select" | "deselect";
    snapshot: ReadonlySet<string>;
    lastRowId: string;
    lastY: number;
  } | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollDirectionRef = useRef<-1 | 0 | 1>(0);
  const autoScrollTargetRef = useRef(0);
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

  const refreshRects = useCallback(async () => {
    const offset = getScrollOffset();
    rectsRef.current = await measureRows();
    rectsOffsetRef.current = offset;
  }, [getScrollOffset, measureRows]);

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

      const row = rowAtPosition({
        rects: rectsRef.current,
        absoluteY,
        offsetDelta: getScrollOffset() - rectsOffsetRef.current,
      });
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
    [getScrollOffset, setSelection]
  );

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollDirectionRef.current = 0;
  }, []);

  /**
   * Distance travelled per second, ramped by how far past the edge the finger
   * is. Scrolling at full speed the moment the zone is entered overshoots the
   * row the user was aiming for; ramping makes the edge feel like a dial.
   */
  const currentSpeed = useCallback(() => {
    const listRect = listRectRef.current;
    const drag = dragRef.current;
    if (!(listRect && drag)) return AUTO_SCROLL_MIN_SPEED;

    const direction = autoScrollDirectionRef.current;
    const distanceIntoZone =
      direction > 0
        ? drag.lastY - (listRect.bottom - bottomInset - AUTO_SCROLL_EDGE)
        : listRect.top + AUTO_SCROLL_EDGE - drag.lastY;
    const depth = Math.min(1, Math.max(0, distanceIntoZone / AUTO_SCROLL_EDGE));

    return (
      AUTO_SCROLL_MIN_SPEED +
      depth * (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED)
    );
  }, [bottomInset]);

  /**
   * One rAF loop for the whole drag, driving a target offset it owns.
   *
   * Stepping a fixed distance on a timer, from an offset read back out of the
   * throttled scroll events, made the list stutter: the read lagged the writes,
   * so each tick started from a stale place. This advances by elapsed time and
   * keeps its own target, only consulting the real offset to avoid running away
   * past the end of the list.
   */
  const runAutoScroll = useCallback(() => {
    let lastTimestamp: number | null = null;
    let sinceMeasure = 0;

    const frame = (timestamp: number) => {
      const drag = dragRef.current;
      const direction = autoScrollDirectionRef.current;

      if (!drag || direction === 0) {
        stopAutoScroll();
        return;
      }

      const elapsed =
        lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const actual = getScrollOffset();
      const target = Math.max(
        0,
        autoScrollTargetRef.current + direction * currentSpeed() * elapsed
      );

      // The list clamps at its ends, so the target has to stay near the real
      // offset -- otherwise it keeps accumulating against a list that can't move
      // and takes just as long to unwind when the drag reverses.
      autoScrollTargetRef.current =
        direction > 0
          ? Math.min(target, actual + AUTO_SCROLL_MAX_LEAD)
          : Math.max(target, actual - AUTO_SCROLL_MAX_LEAD);

      scrollToOffset(autoScrollTargetRef.current);

      // Cheap now that it doesn't measure: the finger hasn't moved, but the rows
      // under it have, so this is what picks up each row as it passes.
      applyAt(drag.lastY);

      sinceMeasure += elapsed * 1000;

      if (sinceMeasure >= REMEASURE_INTERVAL_MS) {
        sinceMeasure = 0;
        refreshRects();
      }

      autoScrollFrameRef.current = requestAnimationFrame(frame);
    };

    autoScrollFrameRef.current = requestAnimationFrame(frame);
  }, [
    applyAt,
    currentSpeed,
    getScrollOffset,
    refreshRects,
    scrollToOffset,
    stopAutoScroll,
  ]);

  const updateAutoScroll = useCallback(
    (absoluteY: number, velocityY: number) => {
      const listRect = listRectRef.current;
      if (!listRect) return;

      const direction = nextAutoScrollDirection({
        absoluteY,
        velocityY,
        listTop: listRect.top,
        listBottom: listRect.bottom,
        bottomInset,
        edge: AUTO_SCROLL_EDGE,
        isScrolling: autoScrollFrameRef.current !== null,
      });

      if (direction === 0) {
        stopAutoScroll();
        return;
      }

      autoScrollDirectionRef.current = direction;

      if (autoScrollFrameRef.current !== null) return;

      autoScrollTargetRef.current = getScrollOffset();
      runAutoScroll();
    },
    [bottomInset, getScrollOffset, runAutoScroll, stopAutoScroll]
  );

  const handleDragStart = useCallback(
    async (absoluteY: number) => {
      const [, listRect] = await Promise.all([refreshRects(), measureList()]);

      listRectRef.current = listRect;

      const row = rowAtPosition({ rects: rectsRef.current, absoluteY });
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
    [applyAt, enterSelectionMode, getSelectedIds, measureList, refreshRects]
  );

  const handleDragMove = useCallback(
    (absoluteY: number, velocityY: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      drag.lastY = absoluteY;
      applyAt(absoluteY);
      updateAutoScroll(absoluteY, velocityY);
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
      runOnJS(handleDragMove)(event.absoluteY, event.velocityY);
    })
    .onFinalize(() => {
      runOnJS(handleDragEnd)();
    });

  return { gesture, registerRow, registerList };
};
