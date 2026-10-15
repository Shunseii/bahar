import type { DbConnectionInfo } from "@bahar/db-core";

const CONNECTION_INFO_KEY = "bahar-db-connection";

/**
 * The last connection info the API returned, kept so a cold start without a
 * network can still open the local replica.
 *
 * Without it `runDbInit` cannot get past its first step offline: fetching
 * connection info is a network call, and failing it returns `err`, which
 * reaches the blocking error page. The replica is sitting in OPFS the whole
 * time, fully usable.
 *
 * This does hold `access_token`, so it is a credential at rest. It is the
 * same token the running app already keeps in memory and hands to the sync
 * engine, scoped to this one user's database, and it expires server-side
 * (7 days, refreshed well before). localStorage is also already where the
 * engine keeps its own sync metadata for this origin, so the token is not
 * reaching anywhere it could not already.
 */
export const readCachedConnectionInfo = (): DbConnectionInfo | null => {
  try {
    const raw = localStorage.getItem(CONNECTION_INFO_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<DbConnectionInfo>;
    if (
      typeof parsed.access_token !== "string" ||
      typeof parsed.hostname !== "string" ||
      typeof parsed.db_name !== "string"
    ) {
      return null;
    }

    return {
      access_token: parsed.access_token,
      hostname: parsed.hostname,
      db_name: parsed.db_name,
    };
  } catch {
    return null;
  }
};

export const writeCachedConnectionInfo = (info: DbConnectionInfo): void => {
  try {
    localStorage.setItem(CONNECTION_INFO_KEY, JSON.stringify(info));
  } catch {
    // Non-fatal: we lose the offline cold start, not this session.
  }
};

export const clearCachedConnectionInfo = (): void => {
  try {
    localStorage.removeItem(CONNECTION_INFO_KEY);
  } catch {
    // Non-fatal.
  }
};
