import {
  applyDragRange,
  idsInRange,
  nextAutoScrollDirection,
  type RowRect,
  rowAtPosition,
} from "./useDragSelect";

/** Two 100pt rows with the list's 12pt gap between them. */
const RECTS: RowRect[] = [
  { id: "first", top: 100, bottom: 200 },
  { id: "second", top: 212, bottom: 312 },
];

const ORDERED = ["a", "b", "c", "d", "e"];

describe("rowAtPosition", () => {
  it("finds the row the finger is inside", () => {
    expect(rowAtPosition({ rects: RECTS, absoluteY: 150 })?.id).toBe("first");
    expect(rowAtPosition({ rects: RECTS, absoluteY: 300 })?.id).toBe("second");
  });

  it("includes the row's own edges", () => {
    expect(rowAtPosition({ rects: RECTS, absoluteY: 100 })?.id).toBe("first");
    expect(rowAtPosition({ rects: RECTS, absoluteY: 200 })?.id).toBe("first");
  });

  it("returns nothing in the gap between rows", () => {
    expect(rowAtPosition({ rects: RECTS, absoluteY: 206 })).toBeUndefined();
  });

  it("returns nothing above the first row or below the last", () => {
    expect(rowAtPosition({ rects: RECTS, absoluteY: 40 })).toBeUndefined();
    expect(rowAtPosition({ rects: RECTS, absoluteY: 900 })).toBeUndefined();
  });

  it("returns nothing when no rows have been measured", () => {
    expect(rowAtPosition({ rects: [], absoluteY: 150 })).toBeUndefined();
  });
});

describe("idsInRange", () => {
  it("covers the rows between the anchor and the finger", () => {
    expect(
      idsInRange({ orderedIds: ORDERED, anchorId: "b", currentId: "d" })
    ).toEqual(["b", "c", "d"]);
  });

  it("works the same dragging upward", () => {
    expect(
      idsInRange({ orderedIds: ORDERED, anchorId: "d", currentId: "b" })
    ).toEqual(["b", "c", "d"]);
  });

  it("is just the anchor before the finger has moved off it", () => {
    expect(
      idsInRange({ orderedIds: ORDERED, anchorId: "c", currentId: "c" })
    ).toEqual(["c"]);
  });

  it("covers nothing when a row is no longer in the list", () => {
    expect(
      idsInRange({ orderedIds: ORDERED, anchorId: "gone", currentId: "c" })
    ).toEqual([]);
  });
});

describe("applyDragRange", () => {
  it("adds the range when the drag started on an unselected row", () => {
    const result = applyDragRange({
      snapshot: new Set(["e"]),
      rangeIds: ["b", "c"],
      mode: "select",
    });

    expect([...result].sort()).toEqual(["b", "c", "e"]);
  });

  it("removes the range when the drag started on a selected row", () => {
    const result = applyDragRange({
      snapshot: new Set(["a", "b", "c"]),
      rangeIds: ["b", "c"],
      mode: "deselect",
    });

    expect([...result]).toEqual(["a"]);
  });

  it("leaves the rest of the selection alone", () => {
    const result = applyDragRange({
      snapshot: new Set(["a", "e"]),
      rangeIds: ["b"],
      mode: "select",
    });

    expect([...result].sort()).toEqual(["a", "b", "e"]);
  });

  it("undoes rows the drag no longer covers", () => {
    // Dragging b→d and then back to c: the shorter range is applied to the
    // same snapshot, so d returns to its pre-drag state instead of sticking.
    const snapshot = new Set<string>();
    const extended = applyDragRange({
      snapshot,
      rangeIds: idsInRange({
        orderedIds: ORDERED,
        anchorId: "b",
        currentId: "d",
      }),
      mode: "select",
    });
    const pulledBack = applyDragRange({
      snapshot,
      rangeIds: idsInRange({
        orderedIds: ORDERED,
        anchorId: "b",
        currentId: "c",
      }),
      mode: "select",
    });

    expect([...extended]).toEqual(["b", "c", "d"]);
    expect([...pulledBack]).toEqual(["b", "c"]);
  });

  it("never mutates the snapshot it was given", () => {
    const snapshot = new Set(["a"]);

    applyDragRange({ snapshot, rangeIds: ["b"], mode: "select" });

    expect([...snapshot]).toEqual(["a"]);
  });
});

describe("nextAutoScrollDirection", () => {
  /** A list filling a 800pt screen, with a 124pt action bar over its bottom. */
  const direction = ({
    absoluteY,
    velocityY,
    isScrolling = false,
  }: {
    absoluteY: number;
    velocityY: number;
    isScrolling?: boolean;
  }) =>
    nextAutoScrollDirection({
      absoluteY,
      velocityY,
      listTop: 100,
      listBottom: 800,
      bottomInset: 124,
      edge: 120,
      isScrolling,
    });

  it("doesn't scroll while the finger is away from the edges", () => {
    expect(direction({ absoluteY: 400, velocityY: 900 })).toBe(0);
  });

  it("scrolls down when the finger drives into the bottom zone", () => {
    expect(direction({ absoluteY: 580, velocityY: 400 })).toBe(1);
  });

  it("scrolls up when the finger drives into the top zone", () => {
    expect(direction({ absoluteY: 150, velocityY: -400 })).toBe(-1);
  });

  it("stays put for a finger resting in a zone", () => {
    // The reason the momentum gate exists: holding the phone puts a thumb near
    // the bottom, and the list crept out from under it.
    expect(direction({ absoluteY: 580, velocityY: 0 })).toBe(0);
    expect(direction({ absoluteY: 580, velocityY: 40 })).toBe(0);
  });

  it("ignores momentum pointing away from the zone's edge", () => {
    expect(direction({ absoluteY: 580, velocityY: -400 })).toBe(0);
    expect(direction({ absoluteY: 150, velocityY: 400 })).toBe(0);
  });

  it("keeps scrolling once started, even if the finger stops", () => {
    expect(direction({ absoluteY: 580, velocityY: 0, isScrolling: true })).toBe(
      1
    );
  });

  it("stops as soon as the finger leaves the zone", () => {
    expect(direction({ absoluteY: 400, velocityY: 0, isScrolling: true })).toBe(
      0
    );
  });

  it("treats the space under the action bar as part of the bottom zone", () => {
    // 700 is inside the bar's 124pt, so it counts as past the edge.
    expect(direction({ absoluteY: 700, velocityY: 400 })).toBe(1);
  });
});
