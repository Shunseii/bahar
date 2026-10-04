import { describe, expect, it } from "vitest";
import {
  type DbConnectionInfo,
  type DbPlatform,
  type RetryPolicy,
  runDbInit,
  runSync,
} from "./init";

/**
 * Retry is exercised by its own tests below; everywhere else it would only
 * add real backoff to a fault that is meant to surface, so the default
 * policy is replaced with a single attempt.
 */
const NO_RETRY: RetryPolicy = { attempts: 1, delayMs: () => 0 };

/** Same number of attempts as the default, without the wall-clock wait. */
const INSTANT_RETRY: RetryPolicy = { attempts: 3, delayMs: () => 0 };

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
  deleteLocalReplica: () => {},
  restart: async () => {},
});

const noOpMigrations = async () => ({ ok: true, value: null }) as const;

describe("runDbInit", () => {
  it("returns ok when the happy path succeeds", async () => {
    const platform = makePlatform();

    const result = await runDbInit(platform, {
      retry: NO_RETRY,
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
        retry: NO_RETRY,
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
        retry: NO_RETRY,
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
        retry: NO_RETRY,
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
        retry: NO_RETRY,
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
        retry: NO_RETRY,
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
        retry: NO_RETRY,
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
        retry: NO_RETRY,
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
        retry: NO_RETRY,
        applyRequiredMigrations: noOpMigrations,
      });

      expect(result).toMatchObject({
        outcome: "degraded",
        error: { type: "turso_remote_sync_failed" },
      });
    });
  });
});

describe("retry on the network-only stages", () => {
  // The flaky-connection case BAHAR-WEB-38 is really about: one attempt fails,
  // the next succeeds, and the user never sees a degraded or blocked app.
  it("recovers when a transient getConnectionInfo failure clears on retry", async () => {
    let attempts = 0;
    const platform: DbPlatform = {
      ...makePlatform(),
      getConnectionInfo: async () => {
        attempts++;
        if (attempts === 1) throw new TypeError("Failed to fetch");
        return CONNECTION_INFO;
      },
    };

    const result = await runDbInit(platform, {
      retry: INSTANT_RETRY,
      applyRequiredMigrations: noOpMigrations,
    });

    expect(result).toEqual({ outcome: "ok" });
    expect(attempts).toBe(2);
  });

  it("recovers when a transient first pull clears on retry", async () => {
    let attempts = 0;
    const platform: DbPlatform = {
      ...makePlatform(),
      pull: async () => {
        attempts++;
        if (attempts === 1) throw new TypeError("Failed to fetch");
      },
    };

    const result = await runDbInit(platform, {
      retry: INSTANT_RETRY,
      applyRequiredMigrations: noOpMigrations,
    });

    expect(result).toEqual({ outcome: "ok" });
  });

  it("gives up after the configured number of attempts", async () => {
    let attempts = 0;
    const platform: DbPlatform = {
      ...makePlatform(),
      getConnectionInfo: async () => {
        attempts++;
        throw new TypeError("Failed to fetch");
      },
    };

    const result = await runDbInit(platform, {
      retry: INSTANT_RETRY,
      applyRequiredMigrations: noOpMigrations,
    });

    expect(result).toMatchObject({
      outcome: "err",
      error: { type: "get_db_info_failed" },
    });
    expect(attempts).toBe(3);
  });

  // Credentials do not improve by asking again, and retrying would delay the
  // redirect to login by the full backoff.
  it("does not retry an unauthorized response", async () => {
    let attempts = 0;
    const platform: DbPlatform = {
      ...makePlatform(),
      getConnectionInfo: async () => {
        attempts++;
        throw { status: 401 };
      },
    };

    const result = await runDbInit(platform, {
      retry: INSTANT_RETRY,
      applyRequiredMigrations: noOpMigrations,
    });

    expect(result).toMatchObject({
      outcome: "err",
      error: { type: "unauthorized" },
    });
    expect(attempts).toBe(1);
  });

  // A lock or schema fault repeats identically; retrying just delays it.
  // Asserted on getConnectionInfo because runDbInit calls it exactly once,
  // whereas pull runs again as the post-migration sync and would make the
  // count ambiguous.
  it("does not retry a non-network failure", async () => {
    let attempts = 0;
    const platform: DbPlatform = {
      ...makePlatform(),
      getConnectionInfo: async () => {
        attempts++;
        throw new Error("database is locked");
      },
    };

    await runDbInit(platform, {
      retry: INSTANT_RETRY,
      applyRequiredMigrations: noOpMigrations,
    });

    expect(attempts).toBe(1);
  });

  it("retries the migrations-API fetch and succeeds on the second try", async () => {
    let attempts = 0;
    const platform = makePlatform();

    const result = await runDbInit(platform, {
      retry: INSTANT_RETRY,
      applyRequiredMigrations: async () => {
        attempts++;
        if (attempts === 1) {
          return {
            ok: false,
            error: {
              type: "api_schema_verification_failed",
              reason: "Failed to fetch",
            },
          } as const;
        }
        return { ok: true, value: null } as const;
      },
    });

    expect(result).toEqual({ outcome: "ok" });
    expect(attempts).toBe(2);
  });

  // Once migration SQL has started, repeating the step could double-apply a
  // partially-applied migration -- so only the pre-SQL fetch failure retries.
  it("never repeats the migrations step once SQL has run", async () => {
    let attempts = 0;
    const platform = makePlatform();

    await runDbInit(platform, {
      retry: INSTANT_RETRY,
      applyRequiredMigrations: async () => {
        attempts++;
        return {
          ok: false,
          error: { type: "migration_failed", migrationVersion: 7 },
        } as const;
      },
    });

    expect(attempts).toBe(1);
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
      retry: NO_RETRY,
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
      retry: NO_RETRY,
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

  it("classifies a plain network failure as transient, not a conflict", async () => {
    const platform = makePlatform({
      faults: { pull: new TypeError("Failed to fetch") },
    });

    const result = await runSync(platform);

    expect(result).toMatchObject({
      outcome: "degraded",
      classification: { kind: "transient" },
      error: { type: "turso_remote_sync_failed" },
    });
  });

  it("classifies a sync-protocol failure as a conflict", async () => {
    const platform = makePlatform({
      faults: { pull: new Error("sync error: frame divergence") },
      isSyncError: (reason) => reason.includes("sync error"),
    });

    const result = await runSync(platform);

    expect(result).toMatchObject({
      outcome: "degraded",
      classification: { kind: "conflict" },
    });
  });

  // runSync stamps every failure `turso_remote_sync_failed`, which is not a
  // known-transient type, so an unrecognised reason has to land as permanent.
  it("classifies an unrecognised sync failure as permanent", async () => {
    const platform = makePlatform({
      faults: { pull: new Error("unexpected end of protobuf message") },
    });

    const result = await runSync(platform);

    expect(result).toMatchObject({
      outcome: "degraded",
      classification: { kind: "permanent" },
    });
  });
});
