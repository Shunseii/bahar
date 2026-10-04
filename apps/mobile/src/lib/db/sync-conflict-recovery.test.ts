import type { SyncOutcome } from "@bahar/db-core";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

/**
 * BAHAR-MOBILE-2: conflict recovery is itself network-dependent -- it wipes
 * the local replica and restarts the app, which re-inits via connect+pull.
 * Offline, that turns a sync conflict into data loss: the replica is deleted
 * and the fresh pull can't run.
 *
 * The decision policy lives in @bahar/db-core (recoverFromSyncConflict) and
 * is unit-tested there. What this pins is the mobile wiring -- that
 * performSync actually consults the policy before calling the destructive
 * primitive, which is the seam that would silently rot if someone called
 * recoverFromSyncConflict directly.
 */

const mockDeleteReplica = jest.fn();
const mockRestart = jest.fn<(reason: string) => Promise<void>>();
const mockSyncDb = jest.fn<() => Promise<SyncOutcome>>();
const mockCaptureException = jest.fn();
const mockOffline = jest.fn<() => boolean>();

jest.mock("@sentry/react-native", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock("@bahar/db-operations", () => ({
  enqueueSyncOperation: (operation: () => Promise<void>) => operation(),
}));

// performSync reads entry count / max timestamp around the sync to decide
// whether the dictionary changed, so ensureDb has to hand back something
// preparable or it throws before reaching the sync at all.
const stubDb = {
  prepare: () => ({ get: async () => ({ cnt: 0, max_ts: null }) }),
};

jest.mock("@/lib/db", () => ({
  ensureDb: async () => stubDb,
  syncDb: () => mockSyncDb(),
  dbPlatform: {
    isOffline: () => mockOffline(),
    deleteLocalReplica: () => mockDeleteReplica(),
    restart: (reason: string) => mockRestart(reason),
  },
}));

jest.mock("@/lib/store", () => ({
  store: { set: jest.fn() },
  isSyncingAtom: {},
  dictionaryChangedAtom: {},
  syncCompletedCountAtom: {},
}));

const conflict: SyncOutcome = {
  outcome: "degraded",
  error: { type: "turso_remote_sync_failed", reason: "sync engine conflict" },
  classification: { kind: "conflict" },
};

const transient: SyncOutcome = {
  outcome: "degraded",
  error: { type: "turso_remote_sync_failed", reason: "Network request failed" },
  classification: { kind: "transient" },
};

beforeEach(() => {
  mockDeleteReplica.mockClear();
  mockRestart.mockClear().mockResolvedValue(undefined);
  mockCaptureException.mockClear();
  mockOffline.mockReturnValue(false);
});

import { performSync } from "./sync";

describe("performSync conflict recovery wiring (BAHAR-MOBILE-2)", () => {
  it("recovers on a conflict while online", async () => {
    mockSyncDb.mockResolvedValue(conflict);

    await expect(performSync()).rejects.toThrow();

    expect(mockDeleteReplica).toHaveBeenCalled();
    expect(mockRestart).toHaveBeenCalled();
  });

  it("does not wipe the replica on a conflict while offline", async () => {
    mockOffline.mockReturnValue(true);
    mockSyncDb.mockResolvedValue(conflict);

    await expect(performSync()).rejects.toThrow();

    expect(mockDeleteReplica).not.toHaveBeenCalled();
  });

  it("never recovers from a transient failure, online or not", async () => {
    mockSyncDb.mockResolvedValue(transient);

    await expect(performSync()).rejects.toThrow();

    expect(mockDeleteReplica).not.toHaveBeenCalled();
    // A transient sync failure is expected on a flaky connection and leaves
    // the replica usable, so it must not land in Sentry as an error event.
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
