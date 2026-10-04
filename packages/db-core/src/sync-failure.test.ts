import { describe, expect, it } from "vitest";
import { classifySyncFailure, isSyncConflictError } from "./sync-failure";

const neverConflict = () => false;

describe("classifySyncFailure", () => {
  it("routes a sync-protocol failure to conflict before anything else", () => {
    expect(
      classifySyncFailure({
        error: { type: "turso_remote_sync_failed", reason: "network blip" },
        isSyncError: (reason) => reason.includes("network"),
      })
    ).toEqual({ kind: "conflict" });
  });

  // BAHAR-WEB-38: the migrations-API fetch. Its reason is whatever the fetch
  // layer produced, so the type is the only stable signal that it is retryable.
  it.each([
    "get_db_info_failed",
    "api_schema_verification_failed",
  ])("treats %s as transient whatever the reason says", (type) => {
    expect(
      classifySyncFailure({
        error: { type, reason: "unexpected end of protobuf message" },
        isSyncError: neverConflict,
      })
    ).toEqual({ kind: "transient" });
  });

  it("falls back to reason patterns for types it does not know", () => {
    expect(
      classifySyncFailure({
        error: {
          type: "turso_remote_sync_failed",
          reason: "TypeError: Failed to fetch",
        },
        isSyncError: neverConflict,
      })
    ).toEqual({ kind: "transient" });
  });

  it("reports anything else as permanent, carrying the error", () => {
    const error = {
      type: "migration_failed",
      reason: "no such column: foo",
    };

    expect(classifySyncFailure({ error, isSyncError: neverConflict })).toEqual({
      kind: "permanent",
      error,
    });
  });

  // "fsync error (data_sync_retry=off)" is a disk write failure the engine can
  // emit; a loose conflict check that matched it would route a storage fault
  // into destructive wipe-and-resync.
  it("does not treat an fsync error as transient", () => {
    expect(
      classifySyncFailure({
        error: {
          type: "turso_remote_sync_failed",
          reason: "fsync error (data_sync_retry=off): 5",
        },
        isSyncError: neverConflict,
      })
    ).toMatchObject({ kind: "permanent" });
  });
});

describe("isSyncConflictError", () => {
  it("matches the engine's conflict variant", () => {
    expect(
      isSyncConflictError(
        "sync engine operation failed: database sync engine conflict: diverged at frame 42"
      )
    ).toBe(true);
  });

  // BAHAR-MOBILE-2's actual message. A generic sync failure -- usually just
  // the network -- must never be mistaken for divergence.
  it("does not match a generic sync engine error", () => {
    expect(
      isSyncConflictError(
        "sync engine operation failed: database sync engine error: HTTP request failed: Network request failed"
      )
    ).toBe(false);
  });

  it("does not match a tape error or an fsync error", () => {
    expect(isSyncConflictError("database tape error: bad change type")).toBe(
      false
    );
    expect(isSyncConflictError("fsync error (data_sync_retry=off): 5")).toBe(
      false
    );
  });
});
