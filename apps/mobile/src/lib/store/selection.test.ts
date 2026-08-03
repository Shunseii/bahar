import { addId, describeSelectionScope, toggleId } from "./selection";

describe("toggleId", () => {
  it("adds an id that isn't selected", () => {
    expect([...toggleId(new Set(["a"]), "b")]).toEqual(["a", "b"]);
  });

  it("removes an id that is selected", () => {
    expect([...toggleId(new Set(["a", "b"]), "a")]).toEqual(["b"]);
  });

  it("never mutates the set it was given", () => {
    const original = new Set(["a"]);

    toggleId(original, "b");

    expect([...original]).toEqual(["a"]);
  });
});

describe("describeSelectionScope", () => {
  const scope = (selected: string[], matching: string[]) =>
    describeSelectionScope({
      selectedIds: new Set(selected),
      matchingIds: new Set(matching),
    });

  it("reports everything selected when the results are covered", () => {
    expect(scope(["a", "b"], ["a", "b"])).toEqual({
      matchingCount: 2,
      outsideResultsCount: 0,
      allSelected: true,
    });
  });

  it("counts selected words the search doesn't return", () => {
    // Picked 3 words, then searched something that only matches one of them.
    expect(scope(["a", "b", "c"], ["c", "d"])).toMatchObject({
      outsideResultsCount: 2,
      allSelected: false,
    });
  });

  it("is not 'all selected' just because the selection is bigger than the results", () => {
    // The old bug: 50 selected against 3 results read as everything selected.
    expect(scope(["x", "y", "z", "w"], ["a", "b"]).allSelected).toBe(false);
  });

  it("is not 'all selected' when the search matches nothing", () => {
    expect(scope(["a"], [])).toEqual({
      matchingCount: 0,
      outsideResultsCount: 1,
      allSelected: false,
    });
  });

  it("is not 'all selected' with an empty selection", () => {
    expect(scope([], ["a", "b"]).allSelected).toBe(false);
  });
});

describe("addId", () => {
  it("adds an id that isn't selected", () => {
    expect([...addId(new Set(["a"]), "b")]).toEqual(["a", "b"]);
  });

  it("returns the same set when the id is already selected", () => {
    // Identity is how a drag knows it crossed a row it had already picked up:
    // no new set means no re-render and no extra haptic tick.
    const original = new Set(["a"]);

    expect(addId(original, "a")).toBe(original);
  });
});
