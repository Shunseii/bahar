import {
  type ResolvedSession,
  resolveSession,
  type SessionFetchOutcome,
} from "@bahar/auth-core";
import { polarClient } from "@polar-sh/better-auth/client";
import {
  adminClient,
  apiKeyClient,
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "../../../api/src/auth";
import { queryClient } from "./query";
import {
  clearCachedIdentity,
  readCachedIdentity,
  writeCachedIdentity,
} from "./session-store";
import { generateTraceId, TRACE_ID_HEADER } from "./utils";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    emailOTPClient(),
    adminClient(),
    apiKeyClient(),
    polarClient(),
  ],
  fetchOptions: {
    headers: {
      [TRACE_ID_HEADER]: generateTraceId(),
    },
  },
});

// Reuse a fetched session for as long as the server keeps its signed
// session cookie cache valid (see SESSION_COOKIE_CACHE_EXPIRY_SECS in the API
// auth config). Route `beforeLoad`s run on every navigation and nest three
// deep, so without this each navigation fires several `/get-session` requests
// and rapid navigation trips the endpoint's rate limit (429).
const SESSION_STALE_TIME_MS = 1000 * 60 * 5;

/**
 * Reduces a session fetch to the three cases the policy cares about, and
 * never rejects.
 *
 * better-fetch does not wrap its `fetch` call, so offline the underlying
 * `TypeError: Failed to fetch` propagates straight out of
 * `authClient.getSession()`. That used to reject the query and throw out of
 * `beforeLoad` before the db layer ran at all -- so an offline user never
 * reached the local replica holding their data.
 *
 * Only a confirmed answer signs anyone out. A 401, or a 200 carrying no
 * session, is the server exercising authority. Anything else -- a thrown
 * fetch, a 429, a 5xx -- says nothing about the user, so it resolves to
 * `unreachable` and the cached identity decides.
 */
type LiveSessionUser = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>["data"]
>["user"];

/**
 * The cached outcome, plus the live user when there was one.
 *
 * `user` carries fields the identity policy deliberately does not -- plan and
 * subscription status. Those are entitlements, and a cached entitlement is
 * not something to gate billing on, so they are available only while the
 * server is actually answering.
 */
type SessionFetchResult = {
  outcome: SessionFetchOutcome;
  user: LiveSessionUser | null;
};

const fetchSessionOutcome = async (): Promise<SessionFetchResult> => {
  try {
    const { data, error } = await authClient.getSession();

    if (error) {
      return {
        outcome:
          error.status === 401
            ? { kind: "loggedOut" }
            : { kind: "unreachable" },
        user: null,
      };
    }

    if (!data?.user) return { outcome: { kind: "loggedOut" }, user: null };

    return {
      outcome: {
        kind: "authenticated",
        identity: {
          userId: data.user.id,
          email: data.user.email,
          expiresAtMs: new Date(data.session.expiresAt).getTime(),
        },
      },
      user: data.user,
    };
  } catch {
    return { outcome: { kind: "unreachable" }, user: null };
  }
};

const sessionQueryOptions = {
  queryKey: ["auth.session"],
  queryFn: fetchSessionOutcome,
  staleTime: SESSION_STALE_TIME_MS,
} as const;

/**
 * The effective session: live when the server answered, the persisted
 * identity when it could not be reached, and nothing once a sign-out is
 * confirmed.
 *
 * Deduped across the nested `beforeLoad`s via Tanstack Query. Resolution
 * happens outside the query so the cached outcome stays a plain value and
 * the storage write is not buried in a query function.
 */
export const getResolvedSession = async (): Promise<ResolvedSession> => {
  const { outcome } = await queryClient.ensureQueryData(sessionQueryOptions);

  const resolved = resolveSession({
    outcome,
    cached: readCachedIdentity(),
    nowMs: Date.now(),
  });

  if (resolved.store === "write") {
    writeCachedIdentity(resolved.identity);
  } else if (resolved.store === "clear") {
    clearCachedIdentity();
  }

  return resolved;
};

/**
 * Drops the cached session so the next read refetches.
 *
 * Must be called whenever the session changes outside of a route load --
 * signing in, most importantly. Without it the cached logged-out result
 * survives, so `_authorized-layout` keeps seeing "logged out" while
 * `/login` (which reads the session uncached) sees "logged in", and the two
 * redirect at each other indefinitely.
 *
 * Removes rather than invalidates. `getCachedSession` goes through
 * `ensureQueryData`, which returns whatever is in the cache and only fetches
 * when there is no data at all -- it ignores staleness unless called with
 * `revalidateIfStale`, and even then serves the stale value while
 * refetching behind it. Marking the entry stale therefore changes nothing;
 * the entry has to go. This is the same reason `useLogout` calls
 * `queryClient.clear()`.
 */
export const clearCachedSession = (): void =>
  queryClient.removeQueries({ queryKey: sessionQueryOptions.queryKey });

/**
 * Drops every cached query so a new session starts clean.
 *
 * Call on sign-in. Logout clears the cache too, but anything still in flight
 * at that moment settles afterwards and repopulates it -- a db-backed query
 * refetching as the cookie disappears gets a 401 from ensureDb, and queries
 * default to throwOnError, so that rejection is stored. Signing back in
 * during the same page session remounts the component, the stored error
 * re-throws on render, and the user lands on the error page from inside the
 * app even though initialization just succeeded.
 *
 * Nothing cached under the previous session is worth keeping, and at this
 * point no authorized route is mounted, so clearing wholesale is both safe
 * and the only reliable way to catch whatever settled late.
 */
export const clearQueryCacheForNewSession = (): void => queryClient.clear();

/**
 * The live user, or null when the session came from cache or there is none.
 *
 * Reads the same cached query as {@link getResolvedSession}, so it costs no
 * extra request. Callers gating on plan or subscription must treat null as
 * "cannot tell" and skip the gate rather than assuming free.
 */
export const getLiveSessionUser = async (): Promise<LiveSessionUser | null> => {
  const { user } = await queryClient.ensureQueryData(sessionQueryOptions);

  return user;
};
