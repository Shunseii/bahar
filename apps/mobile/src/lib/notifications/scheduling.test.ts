import {
  BUCKET_MS,
  computeReminders,
  MAX_REMINDERS,
  MIN_GAP_MS,
  MIN_LEAD_MS,
} from "./scheduling";

const NOW = 1_700_000_000_000; // fixed epoch ms so cases are deterministic
const MIN = 60 * 1000;

describe("computeReminders", () => {
  it("returns no reminders when nothing is due in the future", () => {
    expect(computeReminders([NOW - 1000, NOW], NOW)).toEqual([]);
    expect(computeReminders([], NOW)).toEqual([]);
  });

  it("collapses a staggered review batch into a single reminder", () => {
    // 20 cards graded seconds apart, all due ~15 min out -> one bucket.
    const batch = Array.from(
      { length: 20 },
      (_, i) => NOW + 15 * MIN + i * 1000
    );

    const result = computeReminders(batch, NOW);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(20);
    expect(result[0].fireAt).toBe(batch[0]); // earliest due
  });

  it("fires at the earliest actual due time in a bucket, not the bucket edge", () => {
    const due = NOW + 15 * MIN;

    const result = computeReminders([due], NOW);

    expect(result[0].fireAt).toBe(due);
    expect(result[0].fireAt % BUCKET_MS).not.toBe(0); // not floored to a boundary
  });

  it("clamps fireAt to at least NOW + MIN_LEAD_MS", () => {
    const soon = NOW + 5000; // < MIN_LEAD_MS ahead

    const result = computeReminders([soon], NOW);

    expect(result[0].fireAt).toBe(NOW + MIN_LEAD_MS);
  });

  it("merges buckets closer together than MIN_GAP_MS into one reminder", () => {
    const clusterA = NOW + 15 * MIN;
    const clusterB = NOW + 45 * MIN; // 30 min after A, < MIN_GAP_MS

    const result = computeReminders([clusterA, clusterB], NOW);

    expect(result).toHaveLength(1); // no second notification within MIN_GAP
    expect(result[0].fireAt).toBe(clusterA);
    // count is "cards due BY fireAt": B (due 30 min later) isn't due yet at A's
    // fire time, so it's not counted here -- it's picked up on the next recompute.
    expect(result[0].count).toBe(1);
  });

  it("schedules separately when clusters are at least MIN_GAP_MS apart", () => {
    const clusterA = NOW + 15 * MIN;
    const clusterB = NOW + MIN_GAP_MS + 15 * MIN;

    const result = computeReminders([clusterA, clusterB], NOW);

    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(1);
    expect(result[1].fireAt).toBe(clusterB);
    expect(result[1].count).toBe(2); // cumulative
  });

  it("caps the number of scheduled reminders at MAX_REMINDERS", () => {
    const clusters = Array.from(
      { length: MAX_REMINDERS + 2 },
      (_, i) => NOW + (i + 1) * (MIN_GAP_MS + MIN)
    );

    const result = computeReminders(clusters, NOW);

    expect(result).toHaveLength(MAX_REMINDERS);
    expect(result[0].fireAt).toBe(clusters[0]); // earliest kept
    for (let i = 1; i < result.length; i++) {
      expect(result[i].fireAt).toBeGreaterThan(result[i - 1].fireAt);
    }
  });
});
