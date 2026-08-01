import * as Haptics from "expo-haptics";
import { useCallback, useRef } from "react";
import type { View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

/**
 * How long a finger has to rest on a word before the drag-select gesture takes
 * over. Below ~250ms the list starts eating scroll flicks; above ~450ms the
 * long press stops feeling connected to the press.
 */
const LONG_PRESS_DURATION_MS = 300;

export interface RowRect {
  id: string;
  top: number;
  bottom: number;
}

/**
 * The row the finger is over, in window coordinates. Rows are laid out with a
 * gap between them, so a position in that gap belongs to no row and the drag
 * simply selects nothing until it reaches the next one.
 */
export const rowAtPosition = ({
  rects,
  absoluteY,
}: {
  rects: RowRect[];
  absoluteY: number;
}): RowRect | undefined =>
  rects.find((rect) => absoluteY >= rect.top && absoluteY <= rect.bottom);

interface UseDragSelectOptions {
  /**
   * Called with the row the long press landed on. Enters selection mode and
   * selects that row.
   */
  onSelectionStart: (id: string) => void;
  /**
   * Called for every row the finger reaches afterwards. Selects without
   * toggling, so wobbling back over a row can't unselect it.
   */
  onCross: (id: string) => boolean;
}

/**
 * Long-press-then-drag selection for the dictionary list, the way a photo
 * gallery does it: hold a word to start selecting, then keep the finger down and
 * slide over neighbours to add them.
 *
 * Rows are hit-tested against window coordinates measured when the gesture
 * activates. That single measurement stays valid for the whole drag because an
 * active pan owns the touch -- the list can't scroll underneath it -- and it
 * avoids measuring every row on every scroll frame just in case a drag starts.
 */
export const useDragSelect = ({
  onSelectionStart,
  onCross,
}: UseDragSelectOptions) => {
  const rowRefs = useRef(new Map<string, View>());
  const rectsRef = useRef<RowRect[]>([]);
  const isDraggingRef = useRef(false);

  const registerRow = useCallback((id: string, node: View | null) => {
    if (node) {
      rowRefs.current.set(id, node);
    } else {
      rowRefs.current.delete(id);
    }
  }, []);

  const measureRows = useCallback(
    () =>
      Promise.all(
        [...rowRefs.current.entries()].map(
          ([id, node]) =>
            new Promise<RowRect | null>((resolve) => {
              node.measureInWindow((_x, y, _width, height) => {
                // An unmounted or not-yet-laid-out row measures as zero-height;
                // keeping it would create a hit target at the top of the screen.
                if (!height) {
                  resolve(null);
                  return;
                }

                resolve({ id, top: y, bottom: y + height });
              });
            })
        )
      ).then((rects) => rects.filter((rect): rect is RowRect => rect !== null)),
    []
  );

  const rowAt = (absoluteY: number) =>
    rowAtPosition({ rects: rectsRef.current, absoluteY });

  const handleDragStart = useCallback(
    async (absoluteY: number) => {
      isDraggingRef.current = true;
      rectsRef.current = await measureRows();

      const row = rowAt(absoluteY);
      if (!row) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelectionStart(row.id);
    },
    [measureRows, onSelectionStart]
  );

  const handleDragMove = useCallback(
    (absoluteY: number) => {
      if (!isDraggingRef.current) return;

      const row = rowAt(absoluteY);
      if (!row) return;

      if (onCross(row.id)) {
        Haptics.selectionAsync();
      }
    },
    [onCross]
  );

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    rectsRef.current = [];
  }, []);

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

  return { gesture, registerRow };
};
