import { describe, expect, it } from "@jest/globals";

import { toOutcome } from "./session-outcome";

type SessionState = Parameters<typeof toOutcome>[0];

/**
 * better-auth's session and error types carry far more than toOutcome reads.
 * The fixtures supply only the fields under test and widen at the boundary,
 * so a field being added upstream does not break these.
 */
const state = (partial: {
  data?: { user: { id: string; email: string }; session: { expiresAt: Date } };
  error?: { status: number; message?: string };
}): SessionState =>
  ({
    data: null,
    error: null,
    isPending: false,
    ...partial,
  }) as unknown as SessionState;

const sessionData = {
  user: { id: "u1", email: "someone@example.com" },
  session: { expiresAt: new Date("2030-01-01T00:00:00Z") },
};

describe("toOutcome", () => {
  it("reads a live session as authenticated", () => {
    expect(toOutcome(state({ data: sessionData }))).toEqual({
      kind: "authenticated",
      identity: {
        userId: "u1",
        email: "someone@example.com",
        expiresAtMs: new Date("2030-01-01T00:00:00Z").getTime(),
      },
    });
  });

  // The whole point: better-auth's store catches a thrown fetch and leaves
  // `data: null` with the error attached, so judging by `data` alone put an
  // offline user with a full local replica on the login screen.
  it("reads a network failure as unreachable, not signed out", () => {
    expect(
      toOutcome(state({ error: { status: 0, message: "Failed to fetch" } }))
    ).toEqual({ kind: "unreachable" });
  });

  it("reads a rate limit as unreachable", () => {
    expect(toOutcome(state({ error: { status: 429 } }))).toEqual({
      kind: "unreachable",
    });
  });

  it("reads a 401 as a confirmed sign-out", () => {
    expect(toOutcome(state({ error: { status: 401 } }))).toEqual({
      kind: "loggedOut",
    });
  });

  it("reads a clean response with no user as a confirmed sign-out", () => {
    expect(toOutcome(state({}))).toEqual({ kind: "loggedOut" });
  });
});
