import {
  applyDragRange,
  idsInRange,
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
