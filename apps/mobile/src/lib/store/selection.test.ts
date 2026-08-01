import { addId, toggleId } from "./selection";

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
