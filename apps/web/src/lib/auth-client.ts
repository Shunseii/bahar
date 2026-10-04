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

const sessionQueryOptions = {
  queryKey: ["auth.session"],
  queryFn: () => authClient.getSession(),
  staleTime: SESSION_STALE_TIME_MS,
} as const;

// Derived from the (non-generic) queryFn rather than
// `ReturnType<typeof authClient.getSession>`: `getSession` is generic and its
// return type varies on the type param, so `ReturnType` collapses it to `any`.
type SessionResult = Awaited<ReturnType<typeof sessionQueryOptions.queryFn>>;

/**
 * Fetches the current session, deduped across route `beforeLoad` calls and
 * rapid navigation via Tanstack Query. Returns better-auth's
 * `{ data, error }` shape untouched. The cache is cleared on logout via
 * `queryClient.clear()` in `useLogout`.
 */
export const getCachedSession = (): Promise<SessionResult> =>
  queryClient.ensureQueryData(sessionQueryOptions);

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
 * True only for a *confirmed* logged-out response. better-auth returns a 200
 * with `data: null` (and no error) when there's no session, or a 401. A 429
 * rate-limit or a network failure returns `data: null` WITH a transient error
 * -- those must NOT be treated as logged out, otherwise a redirect to the
 * unauthorized layout calls `resetDb()` and closes the local db mid-read.
 */
export const isLoggedOut = ({ data, error }: SessionResult): boolean =>
  !data && (!error || error.status === 401);
