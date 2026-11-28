import { describe, expect, it } from "vitest";
import { guessRootKeys, rootKey } from "./root";

describe("rootKey", () => {
  it("treats weak letters and hamza as one letter", () => {
    expect(rootKey(["ق", "و", "ل"])).toBe(rootKey(["ق", "ا", "ل"]));
    expect(rootKey(["س", "ء", "ل"])).toBe(rootKey(["س", "ي", "ل"]));
  });
});

describe("guessRootKeys", () => {
  it.each([
    ["تجريب", "جرب"],
    ["يجرب", "جرب"],
    ["مجرّب", "جرب"],
    ["تجارب", "جرب"],
    ["التجربة", "جرب"],
    ["استخراج", "خرج"],
    ["اختبار", "خبر"],
    ["مكتوب", "كتب"],
  ])("finds the root of %s", (word, root) => {
    expect(guessRootKeys(word)).toContain(rootKey([...root]));
  });

  it("finds doubled roots once the shadda is gone", () => {
    expect(guessRootKeys("جرّ")).toContain(rootKey(["ج", "ر", "ر"]));
    expect(guessRootKeys("شرّة")).toContain(rootKey(["ش", "ر", "ر"]));
    expect(guessRootKeys("يضر")).toContain(rootKey(["ض", "ر", "ر"]));
  });

  it("guesses nothing for multi-word or very short input", () => {
    expect(guessRootKeys("انصت الى")).toEqual([]);
    expect(guessRootKeys("من")).toEqual([]);
  });
});
