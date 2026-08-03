import { describe, expect, it } from "vitest";
import { formatDistinctIntervals } from "./intervals";

const NOW = new Date(2026, 0, 1, 12, 0, 0);

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const dueIn = (ms: number) => new Date(NOW.getTime() + ms);

const format = (dates: Date[], locale = "en") =>
  formatDistinctIntervals({ dates, now: NOW, locale });

describe("formatDistinctIntervals", () => {
  it("leaves labels untouched when none collide", () => {
    const labels = format([
      dueIn(10 * MINUTE_MS),
      dueIn(2 * HOUR_MS),
      dueIn(3 * DAY_MS),
      dueIn(20 * DAY_MS),
    ]);

    expect(labels).toEqual(["in 10m", "in 2h", "in 3d", "in 3w"]);
  });

  it("steps a day-scale collision down to hours", () => {
    const labels = format([dueIn(2 * DAY_MS), dueIn(2 * DAY_MS + 6 * HOUR_MS)]);

    expect(labels).toEqual(["in 48h", "in 54h"]);
  });

  it("steps a week-scale collision down until the labels differ", () => {
    const labels = format([dueIn(10 * DAY_MS), dueIn(11 * DAY_MS)]);

    expect(labels).toEqual(["in 10d", "in 11d"]);
  });

  it("puts a pair back when no unit can separate it", () => {
    // 30 seconds apart is invisible at every unit down to the minute floor.
    // Keeping the last attempt would render "in 4,320m" twice: still identical,
    // and now unreadable too.
    const labels = format([dueIn(3 * DAY_MS), dueIn(3 * DAY_MS + 30 * 1000)]);

    expect(labels).toEqual(["in 3d", "in 3d"]);
  });

  it("puts a pair back when two grades fall on the same instant", () => {
    const due = dueIn(3 * DAY_MS);
    const labels = format([due, new Date(due.getTime())]);

    expect(labels).toEqual(["in 3d", "in 3d"]);
  });

  it("never renders a collision as seconds", () => {
    const labels = format([dueIn(3 * DAY_MS), dueIn(3 * DAY_MS + 30 * 1000)]);

    for (const label of labels) {
      expect(label).not.toMatch(/\ds$/);
    }
  });

  it("leaves a month-scale collision alone instead of cascading", () => {
    // The old cascade rendered these as a raw second count ("in 5184000 sec").
    const labels = format([dueIn(60 * DAY_MS), dueIn(63 * DAY_MS)]);

    expect(labels).toEqual(["in 2mo", "in 2mo"]);
  });

  it("resolves several collisions across the four grades independently", () => {
    const labels = format([
      dueIn(2 * DAY_MS),
      dueIn(2 * DAY_MS + 6 * HOUR_MS),
      dueIn(5 * DAY_MS),
      dueIn(5 * DAY_MS + 6 * HOUR_MS),
    ]);

    expect(labels).toEqual(["in 48h", "in 54h", "in 120h", "in 126h"]);
  });

  it("separates what it can and puts back only what it can't", () => {
    const same = dueIn(5 * DAY_MS);
    const labels = format([
      dueIn(2 * DAY_MS),
      dueIn(2 * DAY_MS + 6 * HOUR_MS),
      same,
      new Date(same.getTime()),
    ]);

    expect(labels).toEqual(["in 48h", "in 54h", "in 5d", "in 5d"]);
  });

  it("renders Arabic with Arabic-Indic digits and still dedupes", () => {
    const labels = format(
      [dueIn(2 * DAY_MS), dueIn(2 * DAY_MS + 6 * HOUR_MS)],
      "ar"
    );

    expect(labels[0]).not.toEqual(labels[1]);
    for (const label of labels) {
      expect(label).toMatch(/[٠-٩]/);
    }
  });
});
