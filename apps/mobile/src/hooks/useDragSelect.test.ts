import { type RowRect, rowAtPosition } from "./useDragSelect";

/** Two 100pt rows with the list's 12pt gap between them. */
const RECTS: RowRect[] = [
  { id: "first", top: 100, bottom: 200 },
  { id: "second", top: 212, bottom: 312 },
];

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
