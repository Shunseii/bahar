import { describe, expect, it } from "vitest";
import {
  recoverFromSyncConflict,
  shouldRecoverFromConflict,
} from "./conflict-recovery";
import type { DbPlatform, SyncOutcome } from "./init";

const makeSyncOutcome = ({
  outcome = "degraded",
  conflict = true,
}: {
  outcome?: SyncOutcome["outcome"];
  conflict?: boolean;
} = {}): SyncOutcome =>
  outcome === "ok"
    ? { outcome: "ok" }
    : {
        outcome,
        error: { type: "turso_remote_sync_failed", reason: "sync error" },
        classification: conflict ? { kind: "conflict" } : { kind: "transient" },
      };

describe("shouldRecoverFromConflict", () => {
  it("recovers (wipe+reload) when online and the sync failed with a conflict", async () => {
    const platform: Pick<DbPlatform, "isOffline"> = {
      isOffline: () => false,
    };

    const policy = shouldRecoverFromConflict({
      platform,
      syncOutcome: makeSyncOutcome(),
    });

    expect(policy).toEqual({ shouldRecover: true });
  });

  // BAHAR-MOBILE-2: recoverFromSyncConflict wipes the local replica
  // and restarts, which re-inits via connect+pull -- all network. If
  // the device is offline, wipe+reload leaves the user with nothing:
  // the replica is deleted and the fresh pull can't run. The scenario:
  // sync throws conflict -> recovery would run -> network unavailable ->
  // system must degrade to stale local state, not wipe+reload.
  it("does not wipe when the device is offline (BAHAR-MOBILE-2)", async () => {
    const platform: Pick<DbPlatform, "isOffline"> = {
      isOffline: () => true,
    };

    const policy = shouldRecoverFromConflict({
      platform,
      syncOutcome: makeSyncOutcome({ conflict: true }),
    });

    expect(policy).toEqual({ shouldRecover: false });
  });

  it("does not recover when the failure is not a conflict", async () => {
    const platform: Pick<DbPlatform, "isOffline"> = {
      isOffline: () => false,
    };

    const policy = shouldRecoverFromConflict({
      platform,
      syncOutcome: makeSyncOutcome({ conflict: false }),
    });

    expect(policy).toEqual({ shouldRecover: false });
  });

  it("does not recover when sync succeeded", async () => {
    const platform: Pick<DbPlatform, "isOffline"> = {
      isOffline: () => false,
    };

    const policy = shouldRecoverFromConflict({
      platform,
      syncOutcome: makeSyncOutcome({ outcome: "ok" }),
    });

    expect(policy).toEqual({ shouldRecover: false });
  });
});

describe("recoverFromSyncConflict", () => {
  const makeRecoveryPlatform = (isOffline: boolean) => {
    const calls: string[] = [];

    return {
      calls,
      platform: {
        isOffline: () => isOffline,
        deleteLocalReplica: () => {
          calls.push("delete");
        },
        restart: async () => {
          calls.push("restart");
        },
      },
    };
  };

  it("wipes then restarts when online and the failure is a conflict", async () => {
    const { calls, platform } = makeRecoveryPlatform(false);

    const result = await recoverFromSyncConflict({
      platform,
      syncOutcome: makeSyncOutcome({ conflict: true }),
    });

    expect(result).toEqual({ recovered: true });
    // Order matters: restarting before the delete would re-init against the
    // replica that is about to be removed.
    expect(calls).toEqual(["delete", "restart"]);
  });

  it("touches nothing when offline", async () => {
    const { calls, platform } = makeRecoveryPlatform(true);

    const result = await recoverFromSyncConflict({
      platform,
      syncOutcome: makeSyncOutcome({ conflict: true }),
    });

    expect(result).toEqual({ recovered: false, reason: "offline" });
    expect(calls).toEqual([]);
  });

  it("touches nothing when the failure is not a conflict", async () => {
    const { calls, platform } = makeRecoveryPlatform(false);

    const result = await recoverFromSyncConflict({
      platform,
      syncOutcome: makeSyncOutcome({ conflict: false }),
    });

    expect(result).toEqual({ recovered: false, reason: "not-a-conflict" });
    expect(calls).toEqual([]);
  });
});
