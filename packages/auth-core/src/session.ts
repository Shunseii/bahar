/**
 * The identity we keep on the device so the app survives a session fetch it
 * cannot make.
 *
 * Deliberately not the full better-auth session: only what the app needs to
 * decide "someone is signed in, and it is this person". The server stays the
 * authority -- this is what we fall back to while we cannot reach it.
 */
export type CachedIdentity = {
  userId: string;
  email: string;
  /** The server session's own expiry, in epoch ms. */
  expiresAtMs: number;
};

/**
 * What a session fetch told us, reduced to the three cases that matter.
 *
 * The distinction that drives everything is `loggedOut` vs `unreachable`.
 * A confirmed logged-out answer is the server exercising authority and must
 * clear the cached identity. An unreachable server says nothing about
 * whether the user is signed in, so the cached identity stands.
 */
export type SessionFetchOutcome =
  | { kind: "authenticated"; identity: CachedIdentity }
  | { kind: "loggedOut" }
  | { kind: "unreachable" };

/**
 * Whose answer the caller is acting on.
 *
 * `cached` means the app is running on a previously-confirmed identity
 * without having reached the server -- the offline case.
 */
export type SessionSource = "live" | "cached" | "none";

/** What the caller should do with its stored copy of the identity. */
export type IdentityStoreAction = "write" | "clear" | "keep";

/**
 * One variant per outcome the policy can reach, rather than a loose record.
 *
 * Pairing the fields this tightly means callers get narrowing for free: past
 * {@link isSignedOut} the identity is non-null, and `store: "write"` implies
 * there is something to write. The combinations that would be nonsense --
 * writing nothing, or a `source: "none"` that still carries an identity --
 * cannot be constructed.
 */
export type ResolvedSession =
  | { identity: CachedIdentity; source: "live"; store: "write" }
  | { identity: CachedIdentity; source: "cached"; store: "keep" }
  | { identity: null; source: "none"; store: "clear" | "keep" };

/**
 * Decides the effective session from a fetch outcome and whatever identity
 * was persisted from a previous run.
 *
 * Pure, so both platforms share one policy: web reads the fetch through
 * Tanstack Query and persists to localStorage, mobile reads better-auth's
 * nanostore and persists to SecureStore, but neither owns the decision.
 */
export const resolveSession = ({
  outcome,
  cached,
  nowMs,
}: {
  outcome: SessionFetchOutcome;
  cached: CachedIdentity | null;
  nowMs: number;
}): ResolvedSession => {
  if (outcome.kind === "authenticated") {
    return { identity: outcome.identity, source: "live", store: "write" };
  }

  if (outcome.kind === "loggedOut") {
    return { identity: null, source: "none", store: "clear" };
  }

  // Unreachable. The cached identity is all we have, and it is only good
  // until the session it describes would have expired anyway -- past that
  // the server would reject it, so honouring it just delays the inevitable
  // while showing data the user may no longer be entitled to.
  if (!cached) return { identity: null, source: "none", store: "keep" };

  if (cached.expiresAtMs <= nowMs) {
    return { identity: null, source: "none", store: "clear" };
  }

  return { identity: cached, source: "cached", store: "keep" };
};

/**
 * True when the app should treat the user as signed out and send them to
 * login. Distinct from "we could not confirm": an unreachable server with a
 * valid cached identity keeps the user in the app, offline, with their local
 * data.
 */
export const isSignedOut = (
  resolved: ResolvedSession
): resolved is Extract<ResolvedSession, { identity: null }> =>
  resolved.identity === null;
