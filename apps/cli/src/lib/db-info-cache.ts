import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { configDir } from "./credentials";

/**
 * Connection info for the user's personal Turso database, as returned by the
 * API's `/databases/user` endpoint. `hostname` + `access_token` are all
 * `connectUserDb` needs; the rest is passed through for the `db-info` command.
 */
export interface UserDatabaseInfo {
  hostname: string;
  access_token: string;
  [key: string]: unknown;
}

const cachePath = (): string => join(configDir(), "db-info.json");

/**
 * Re-fetch a cached token once it's within this window of expiry. The API hands
 * back long-lived (multi-day) Turso JWTs and refreshes them server-side when
 * they near expiry, so a generous client buffer still means at most a couple of
 * fetches over a token's life -- while keeping every other command off the
 * network (and off the per-key rate limit).
 */
const REFRESH_BUFFER_MS = 24 * 60 * 60 * 1000;

/**
 * Reads the `exp` claim (ms since epoch) from a JWT without verifying it. The
 * signature is irrelevant here -- we only decide whether to reuse or re-fetch.
 * Returns null if the token can't be parsed or has no `exp`.
 */
const jwtExpiryMs = (token: string): number | null => {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
};

/**
 * True if the cached access token is present and not within the refresh buffer
 * of expiry -- i.e. safe to reuse without hitting the API.
 */
export const isAccessTokenFresh = (
  token: string | undefined,
  now = Date.now()
): boolean => {
  if (!token) return false;
  const expMs = jwtExpiryMs(token);
  return expMs !== null && expMs - now > REFRESH_BUFFER_MS;
};

export const loadDbInfoCache = async (): Promise<UserDatabaseInfo | null> => {
  const file = Bun.file(cachePath());
  if (!(await file.exists())) return null;

  try {
    return (await file.json()) as UserDatabaseInfo;
  } catch {
    // A corrupt cache should never be fatal -- fall back to a fresh fetch.
    return null;
  }
};

export const saveDbInfoCache = async (
  info: UserDatabaseInfo
): Promise<void> => {
  const path = cachePath();
  await Bun.write(path, JSON.stringify(info, null, 2));

  if (process.platform !== "win32") {
    // The cache holds a live DB access token -- lock it down like credentials.
    await chmod(path, 0o600);
  }
};

/**
 * Removes the cached db-info. Called on login so a fresh (or different) account
 * never reuses the previous account's cached token.
 */
export const clearDbInfoCache = async (): Promise<void> => {
  await Bun.file(cachePath())
    .delete()
    .catch(() => {
      // No cache to clear is fine.
    });
};
