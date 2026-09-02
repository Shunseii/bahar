import { describe, expect, it } from "vitest";
import {
  type DbConnectionInfo,
  type DbPlatform,
  runDbInit,
  runSync,
} from "./init";

const CONNECTION_INFO: DbConnectionInfo = {
  access_token: "token",
  hostname: "db.bahar.dev",
  db_name: "user-db",
};

/**
 * Fake platform whose network calls fail on demand. `faults` maps a
 * boundary method to the error it should throw, once or forever.
 */
const makePlatform = ({
  faults = {},
  isSyncError = () => false,
  isOffline = () => false,
}: {
  faults?: Partial<{
    getConnectionInfo: Error;
    connect: Error;
    pull: Error;
    push: Error;
  }>;
  isSyncError?: (reason: string) => boolean;
  isOffline?: () => boolean;
} = {}): DbPlatform => ({
  getConnectionInfo: async () => {
    if (faults.getConnectionInfo) throw faults.getConnectionInfo;
    return CONNECTION_INFO;
  },
  connect: async () => {
    if (faults.connect) throw faults.connect;
  },
  pull: async () => {
    if (faults.pull) throw faults.pull;
  },
  push: async () => {
    if (faults.push) throw faults.push;
  },
  isSyncError: (error) => isSyncError(String(error)),
  isOffline,
});

const noOpMigrations = async () => ({ ok: true, value: null }) as const;

describe("runDbInit", () => {
  it("returns ok when the happy path succeeds", async () => {
    const platform = makePlatform();

    const result = await runDbInit(platform, {
      applyRequiredMigrations: noOpMigrations,
    });

    expect(result).toEqual({ outcome: "ok" });
  });

  describe("blocking failures (err outcome)", () => {
    it("returns err with get_db_info_failed when the API is unreachable", async () => {
      const platform = makePlatform({
        faults: {
          getConnectionInfo: new TypeError("Failed to fetch"),
        },
      });

      const result = await runDbInit(platform, {
        applyRequiredMigrations: noOpMigrations,
      });

      expect(result).toMatchObject({
        outcome: "err",
        error: { type: "get_db_info_failed" },
      });
    });

    it("returns err with unauthorized on a 401 from the API", async () => {
      const platform = makePlatform({
        faults: {
          getConnectionInfo: Object.assign(new Error("401"), { status: 401 }),
        },
      });

      const result = await runDbInit(platform, {
        applyRequiredMigrations: noOpMigrations,
      });

      expect(result).toMatchObject({
        outcome: "err",
        error: { type: "unauthorized" },
      });
    });

    it("returns err with db_connection_failed when connect throws", async () => {
      const platform = makePlatform({
        faults: { connect: new Error("connect failed") },
      });

      const result = await runDbInit(platform, {
        applyRequiredMigrations: noOpMigrations,
      });

      expect(result).toMatchObject({
        outcome: "err",
        error: { type: "db_connection_failed" },
      });
    });

    it("returns err with opfs_lock_error on a createSyncAccessHandle failure", async () => {
      const platform = makePlatform({
        faults: {
          connect: new Error("createSyncAccessHandle: locked"),
        },
      });

      const result = await runDbInit(platform, {
        applyRequiredMigrations: noOpMigrations,
      });

      expect(result).toMatchObject({
        outcome: "err",
        error: { type: "opfs_lock_error" },
      });
    });

    it("returns err when migrations fail", async () => {
      const platform = makePlatform();

      const result = await runDbInit(platform, {
        applyRequiredMigrations: async () =>
          ({
            ok: false,
            error: { type: "migration_failed", reason: "x" },
          }) as const,
      });

      expect(result).toMatchObject({
        outcome: "err",
        error: { type: "migration_failed" },
      });
    });
  });

  // BAHAR-WEB-38: a TypeError: Failed to fetch on api.bahar.dev during
  // Route.beforeLoad db-init used to bubble to the blocking error page
  // even though the local replica was open and usable. The scenario:
  // first sync call faults, orchestration must degrade gracefully to a
  // local-only stale replica instead of blocking.
  describe("graceful degradation (BAHAR-WEB-38)", () => {
    it("returns degraded, not err, when the first pull hits a network fault", async () => {
      const platform = makePlatform({
        faults: { pull: new TypeError("Failed to fetch") },
      });

      const result = await runDbInit(platform, {
        applyRequiredMigrations: noOpMigrations,
      });

      expect(result).toMatchObject({
        outcome: "degraded",
        error: { type: "turso_remote_sync_and_pull_failed" },
      });
    });

    it("still runs migrations when the first pull fails, so the stale replica matches the current schema", async () => {
      const platform = makePlatform({
        faults: { pull: new TypeError("Failed to fetch") },
      });
      let migrationsRan = false;

      const result = await runDbInit(platform, {
        applyRequiredMigrations: async () => {
          migrationsRan = true;
          return { ok: true, value: null } as const;
        },
      });

      expect(migrationsRan).toBe(true);
      expect(result).toMatchObject({ outcome: "degraded" });
    });

    it("returns degraded when only the post-migration push fails", async () => {
      const platform = makePlatform({
        faults: { push: new TypeError("Failed to fetch") },
      });

      const result = await runDbInit(platform, {
        applyRequiredMigrations: noOpMigrations,
      });

      expect(result).toMatchObject({
        outcome: "degraded",
        error: { type: "turso_remote_sync_failed" },
      });
    });
  });
});

describe("runSync", () => {
  it("returns ok when pull and push succeed", async () => {
    const platform = makePlatform();

    const result = await runSync(platform);

    expect(result).toEqual({ outcome: "ok" });
  });

  it("returns degraded when the migrations API fetch fails after a successful connect and pull (BAHAR-WEB-38)", async () => {
    const platform = makePlatform();

    const result = await runDbInit(platform, {
      applyRequiredMigrations: async () =>
        ({
          ok: false,
          error: {
            type: "api_schema_verification_failed",
            reason: "TypeError: Failed to fetch (api.bahar.dev)",
          },
        }) as const,
    });

    expect(result).toMatchObject({
      outcome: "degraded",
      error: { type: "api_schema_verification_failed" },
    });
  });

  it("still blocks on schema-level migration failures", async () => {
    const platform = makePlatform();

    const result = await runDbInit(platform, {
      applyRequiredMigrations: async () =>
        ({
          ok: false,
          error: { type: "migration_failed", reason: "SQL syntax error" },
        }) as const,
    });

    expect(result).toMatchObject({
      outcome: "err",
      error: { type: "migration_failed" },
    });
  });

  it("returns degraded with conflict: false on a plain network failure", async () => {
    const platform = makePlatform({
      faults: { pull: new TypeError("Failed to fetch") },
    });

    const result = await runSync(platform);

    expect(result).toMatchObject({
      outcome: "degraded",
      conflict: false,
      error: { type: "turso_remote_sync_failed" },
    });
  });

  it("returns degraded with conflict: true when the error is a sync error", async () => {
    const platform = makePlatform({
      faults: { pull: new Error("sync error: frame divergence") },
      isSyncError: (reason) => reason.includes("sync error"),
    });

    const result = await runSync(platform);

    expect(result).toMatchObject({
      outcome: "degraded",
      conflict: true,
    });
  });
});
