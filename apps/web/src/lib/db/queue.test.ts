import { describe, expect, it, vi } from "vitest";
import {
  enqueueDbOperation,
  enqueueSyncOperation,
  hasPendingOperations,
} from "./queue";

vi.mock("@sentry/react", () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

const wait = async (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

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

    const promise1 = enqueueSyncOperation(sync1);

    await expect(promise1).rejects.toThrow("sync1 failed");
    expect(hasPendingOperations()).toBe(false);

    const sync2 = vi.fn(() => Promise.resolve());

    const promise2 = enqueueSyncOperation(sync2);
    await promise2;

    expect(sync2).toHaveBeenCalledTimes(1);
    expect(promise2).not.toBe(promise1);
  });
});

describe("enqueueDbOperation", () => {
  it("resolves with the operation's result", async () => {
    const dummyFn = vi.fn(() => Promise.resolve("result"));
    const promise = enqueueDbOperation(dummyFn);

    await expect(promise).resolves.toBe("result");
  });

  it("rejects when the operation throws", async () => {
    const dummyFn = vi.fn(() => Promise.reject(new Error("error")));
    const promise = enqueueDbOperation(dummyFn);

    await expect(promise).rejects.toThrow("error");
  });
});

describe("hasPendingOperations", () => {
  it("reflects sync-pending state across the operation's lifecycle", async () => {
    expect(hasPendingOperations()).toBe(false);

    const dummyFn = vi.fn(() => wait(10));
    const promise = enqueueSyncOperation(dummyFn);

    expect(hasPendingOperations()).toBe(true);

    await promise;

    expect(hasPendingOperations()).toBe(false);
  });
});
