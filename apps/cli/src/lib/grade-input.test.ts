import { describe, expect, test } from "bun:test";
import { Rating } from "ts-fsrs";
import { parseGradeInput } from "./grade-input";

describe("parseGradeInput", () => {
  test("positional: single card, grade last (backward compatible)", () => {
    const items = parseGradeInput({
      positional: ["card-a", "good"],
      stdin: null,
    });
    expect(items).toEqual([
      { id: "card-a", gradeLabel: "good", grade: Rating.Good },
    ]);
  });

  test("positional: many cards, same grade (grade last)", () => {
    const items = parseGradeInput({
      positional: ["a", "b", "c", "hard"],
      stdin: null,
    });

    expect(items).toEqual([
      { id: "a", gradeLabel: "hard", grade: Rating.Hard },
      { id: "b", gradeLabel: "hard", grade: Rating.Hard },
      { id: "c", gradeLabel: "hard", grade: Rating.Hard },
    ]);
  });

  test("positional: grade label is case-insensitive", () => {
    const [item] = parseGradeInput({ positional: ["a", "GOOD"], stdin: null });
    expect(item).toEqual({ id: "a", gradeLabel: "good", grade: Rating.Good });
  });

  test("positional: rejects an unknown grade", () => {
    expect(() =>
      parseGradeInput({ positional: ["a", "meh"], stdin: null })
    ).toThrow(/Invalid grade "meh"/);
  });

  test("positional: requires at least one id (grade only)", () => {
    expect(() =>
      parseGradeInput({ positional: ["hard"], stdin: null })
    ).toThrow(/at least one card id/);
  });

  test("stdin: parses a JSON array of mixed grades", () => {
    const stdin = JSON.stringify([
      { id: "a", grade: "again" },
      { id: "b", grade: "easy" },
    ]);
    const items = parseGradeInput({ positional: [], stdin });

    expect(items).toEqual([
      { id: "a", gradeLabel: "again", grade: Rating.Again },
      { id: "b", gradeLabel: "easy", grade: Rating.Easy },
    ]);
  });

  test("positional takes precedence over stdin", () => {
    const stdin = JSON.stringify([{ id: "z", grade: "easy" }]);
    const items = parseGradeInput({ positional: ["a", "hard"], stdin });
    expect(items).toEqual([
      { id: "a", gradeLabel: "hard", grade: Rating.Hard },
    ]);
  });

  test("returns empty when no positional args and no stdin", () => {
    expect(parseGradeInput({ positional: [], stdin: null })).toEqual([]);
    expect(parseGradeInput({ positional: [], stdin: "   " })).toEqual([]);
  });

  test("stdin: rejects non-array JSON", () => {
    expect(() =>
      parseGradeInput({ positional: [], stdin: '{"id":"a","grade":"good"}' })
    ).toThrow(/array/);
  });

  test("stdin: rejects malformed JSON", () => {
    expect(() =>
      parseGradeInput({ positional: [], stdin: "not json" })
    ).toThrow(/parse stdin as JSON/);
  });

  test("stdin: rejects an entry missing id/grade", () => {
    expect(() =>
      parseGradeInput({ positional: [], stdin: JSON.stringify([{ id: "a" }]) })
    ).toThrow(/index 0/);
  });

  test("rejects duplicate ids", () => {
    expect(() =>
      parseGradeInput({ positional: ["a", "a", "hard"], stdin: null })
    ).toThrow(/Duplicate card id "a"/);
  });
});
