import { describe, expect, it } from "vitest";
import { recoverFromSyncConflict } from "./conflict-recovery";
import type { SyncOutcome } from "./init";

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
