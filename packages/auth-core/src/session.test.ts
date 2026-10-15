import { describe, expect, it } from "vitest";
import { type CachedIdentity, isSignedOut, resolveSession } from "./session";

const NOW = 1_700_000_000_000;

const identity = (overrides: Partial<CachedIdentity> = {}): CachedIdentity => ({
  userId: "u1",
  email: "someone@example.com",
  expiresAtMs: NOW + 1000 * 60 * 60 * 24,
  ...overrides,
});

describe("resolveSession", () => {
  it("takes a live session and tells the caller to persist it", () => {
    const live = identity();

    expect(
      resolveSession({
        outcome: { kind: "authenticated", identity: live },
        cached: identity({ userId: "stale" }),
        nowMs: NOW,
      })
    ).toEqual({ identity: live, source: "live", store: "write" });
  });

  // The server exercising authority. Unlike an unreachable server, this is a
  // real answer and the cached identity must not survive it.
  it("clears the cached identity on a confirmed sign-out", () => {
    expect(
      resolveSession({
        outcome: { kind: "loggedOut" },
        cached: identity(),
        nowMs: NOW,
      })
    ).toEqual({ identity: null, source: "none", store: "clear" });
  });

  // The case the whole package exists for: offline with a usable local
  // replica. The user stays in the app instead of being bounced to a login
  // they cannot complete without a network.
  it("falls back to the cached identity when the server is unreachable", () => {
    const cached = identity();

    expect(
      resolveSession({ outcome: { kind: "unreachable" }, cached, nowMs: NOW })
    ).toEqual({ identity: cached, source: "cached", store: "keep" });
  });

  it("signs out when unreachable with nothing cached", () => {
    expect(
      resolveSession({
        outcome: { kind: "unreachable" },
        cached: null,
        nowMs: NOW,
      })
    ).toEqual({ identity: null, source: "none", store: "keep" });
  });

  // Honouring an identity past the session's own expiry would only show data
  // the server is already refusing, and would break the moment connectivity
  // returned.
  it("drops a cached identity whose session has expired", () => {
    expect(
      resolveSession({
        outcome: { kind: "unreachable" },
        cached: identity({ expiresAtMs: NOW - 1 }),
        nowMs: NOW,
      })
    ).toEqual({ identity: null, source: "none", store: "clear" });
  });

  it("treats expiry as inclusive at the boundary", () => {
    expect(
      resolveSession({
        outcome: { kind: "unreachable" },
        cached: identity({ expiresAtMs: NOW }),
        nowMs: NOW,
      }).source
    ).toBe("none");
  });

  // An unreachable server says nothing about the user, so a still-valid
  // cached identity must survive for the next attempt.
  it("keeps a still-valid cached identity rather than rewriting it", () => {
    expect(
      resolveSession({
        outcome: { kind: "unreachable" },
        cached: identity(),
        nowMs: NOW,
      }).store
    ).toBe("keep");
  });
});

describe("isSignedOut", () => {
  it("is false while running on a cached identity", () => {
    expect(
      isSignedOut(
        resolveSession({
          outcome: { kind: "unreachable" },
          cached: identity(),
          nowMs: NOW,
        })
      )
    ).toBe(false);
  });

  it("is true once there is no identity at all", () => {
    expect(
      isSignedOut(
        resolveSession({
          outcome: { kind: "loggedOut" },
          cached: identity(),
          nowMs: NOW,
        })
      )
    ).toBe(true);
  });
});
