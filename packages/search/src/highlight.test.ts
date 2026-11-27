import { describe, expect, it } from "vitest";
import { findHighlightPositions, highlightWithDiacritics } from "./highlight";

const highlighted = (text: string, term: string) =>
  findHighlightPositions(text, term).map(({ start, end }) =>
    text.slice(start, end)
  );

describe("findHighlightPositions", () => {
  it("highlights the whole word, harakat included, never part of it", () => {
    expect(highlighted("مُتَنَعِّم", "متن")).toEqual(["مُتَنَعِّم"]);
    expect(highlighted("إيّاك والتنعّم", "تنعم")).toEqual(["والتنعّم"]);
  });

  it("ignores harakat and hamza in the query", () => {
    expect(highlighted("أَدَبٌ", "ادب")).toEqual(["أَدَبٌ"]);
    expect(highlighted("ادب", "أَدَب")).toEqual(["ادب"]);
  });

  it("treats ال as optional on either side", () => {
    expect(highlighted("بَيَان", "البيان")).toEqual(["بَيَان"]);
    expect(highlighted("البَيَان", "بيان")).toEqual(["البَيَان"]);
  });

  it("does not highlight a word that only differs by a typo or shares a root", () => {
    expect(highlighted("غنى", "الزنى")).toEqual([]);
    expect(highlighted("جَيْب", "تجريب")).toEqual([]);
    expect(highlighted("جرّب", "تجريب")).toEqual([]);
  });

  it("matches English words by stem but not inside other words", () => {
    expect(highlighted("to arrive", "arrives")).toEqual(["arrive"]);
    expect(highlighted("stone", "tone")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(findHighlightPositions("كتاب", "  ")).toEqual([]);
  });
});

describe("highlightWithDiacritics", () => {
  it("wraps whole words in the given tag and class", () => {
    expect(
      highlightWithDiacritics("the book", "book", {
        HTMLTag: "b",
        CSSClass: "hl",
      })
    ).toBe('the <b class="hl">book</b>');
  });
});
