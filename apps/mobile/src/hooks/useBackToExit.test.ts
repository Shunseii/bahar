import { shouldExitOnBack } from "./useBackToExit";

const NOW = 1_700_000_000_000;

describe("shouldExitOnBack", () => {
  it("does not exit on the first press", () => {
    expect(shouldExitOnBack({ lastPressAt: null, now: NOW })).toBe(false);
  });

  it("exits on a second press inside the window", () => {
    expect(shouldExitOnBack({ lastPressAt: NOW - 500, now: NOW })).toBe(true);
  });

  it("exits on a press right at the window's edge", () => {
    expect(shouldExitOnBack({ lastPressAt: NOW - 2000, now: NOW })).toBe(true);
  });

  it("treats a press after the window as a fresh first press", () => {
    // Otherwise a back press minutes later would close the app with no warning.
    expect(shouldExitOnBack({ lastPressAt: NOW - 2001, now: NOW })).toBe(false);
  });
});
