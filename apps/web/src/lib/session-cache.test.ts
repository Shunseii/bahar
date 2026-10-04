import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

/**
 * Pins the cache semantics behind the post-OTP redirect loop.
 *
 * `getCachedSession` reads through `ensureQueryData`, which returns whatever
 * is in the cache and only fetches when there is no data at all. It ignores
 * staleness unless called with `revalidateIfStale`, and even then serves the
 * stale value while refetching behind it.
 *
 * So invalidating the session after sign-in does nothing: the cached
 * logged-out result is still what the authorized layout reads, and it
 * bounces the user back to /login forever. The entry has to be removed.
 *
 * The first test below fails if `clearCachedSession` is ever switched back to
 * `invalidateQueries`, which is the mistake this guards.
 */

const SESSION_KEY = ["auth.session"] as const;
const STALE_TIME = 1000 * 60 * 5;

const setup = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0 } },
  });

  const getSession = vi
    .fn()
    .mockResolvedValueOnce({ data: null, error: undefined })
    .mockResolvedValue({ data: { user: { id: "u1" } }, error: undefined });

  const read = () =>
    client.ensureQueryData({
      queryKey: SESSION_KEY,
      queryFn: getSession,
      staleTime: STALE_TIME,
    });

  return { client, getSession, read };
};

describe("session cache invalidation after sign-in", () => {
  it("removing the entry makes the next read see the signed-in session", async () => {
    const { client, getSession, read } = setup();

    expect(await read()).toEqual({ data: null, error: undefined });

    client.removeQueries({ queryKey: SESSION_KEY });

    expect(await read()).toEqual({
      data: { user: { id: "u1" } },
      error: undefined,
    });
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it("invalidating is not enough -- the stale logged-out result is still served", async () => {
    const { client, getSession, read } = setup();

    await read();

    await client.invalidateQueries({ queryKey: SESSION_KEY });

    // Still the logged-out result, and no second request was made. This is
    // exactly the state that produced the redirect loop.
    expect(await read()).toEqual({ data: null, error: undefined });
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});

describe("stale errors from the previous session", () => {
  it("a cleared cache drops an error stored after logout", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, throwOnError: true } },
    });

    const entries = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Database initialization failed: unauthorized")
      )
      .mockResolvedValue(["entry"]);

    const read = () =>
      client.fetchQuery({ queryKey: ["entries"], queryFn: entries });

    // A db-backed query losing its session on the way out of the app.
    await expect(read()).rejects.toThrow("unauthorized");
    expect(client.getQueryState(["entries"])?.error).toBeTruthy();

    // Signing back in must not inherit it: throwOnError would re-throw the
    // stored rejection on the next render and drop the user on the error
    // page from inside the app.
    client.clear();

    expect(client.getQueryState(["entries"])).toBeUndefined();
    await expect(read()).resolves.toEqual(["entry"]);
  });
});
