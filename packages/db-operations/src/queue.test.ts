import { describe, expect, it, vi } from "vitest";
import {
  enqueueDbOperation,
  enqueueSyncOperation,
  hasPendingOperations,
} from "./queue";

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe("enqueueDbOperation", () => {
  it("resolves with the operation's result", async () => {
    const dummyFn = vi.fn(() => Promise.resolve("result"));

    await expect(enqueueDbOperation(dummyFn)).resolves.toBe("result");
  });

  it("rejects when the operation throws", async () => {
    const dummyFn = vi.fn(() => Promise.reject(new Error("error")));

    await expect(enqueueDbOperation(dummyFn)).rejects.toThrow("error");
  });

  it("runs operations serially (concurrency 1)", async () => {
    const order: string[] = [];

    const first = enqueueDbOperation(async () => {
      order.push("first-start");
      await wait(20);
      order.push("first-end");
    });
    const second = enqueueDbOperation(async () => {
      order.push("second-start");
    });

    await Promise.all([first, second]);

    // The second op must not start until the first fully finishes.
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });
});

describe("enqueueSyncOperation", () => {
  it("merges concurrent calls into a single in-flight promise", async () => {
    const dummySync = vi.fn(() => wait(20));

    const promise1 = enqueueSyncOperation(dummySync);
    const promise2 = enqueueSyncOperation(dummySync);

    expect(promise1).toBe(promise2);

    await promise1;

    expect(dummySync).toHaveBeenCalledTimes(1);
  });

  it("resets pending state after the operation rejects", async () => {
    const sync1 = vi.fn(() => Promise.reject(new Error("sync1 failed")));

    await expect(enqueueSyncOperation(sync1)).rejects.toThrow("sync1 failed");
    expect(hasPendingOperations()).toBe(false);

    const sync2 = vi.fn(() => Promise.resolve());
    const promise2 = enqueueSyncOperation(sync2);
    await promise2;

    expect(sync2).toHaveBeenCalledTimes(1);
  });
});

describe("hasPendingOperations", () => {
  it("reflects sync-pending state across the operation's lifecycle", async () => {
    expect(hasPendingOperations()).toBe(false);

    const promise = enqueueSyncOperation(() => wait(10));
    expect(hasPendingOperations()).toBe(true);

    await promise;
    expect(hasPendingOperations()).toBe(false);
  });
});
