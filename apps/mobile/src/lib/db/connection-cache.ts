import type { DbConnectionInfo } from "@bahar/db-core";
import * as SecureStore from "expo-secure-store";

const CONNECTION_INFO_KEY = "bahar-db-connection";

/**
 * The last connection info the API returned, kept so a cold launch without
 * a network can still open the local replica.
 *
 * Without it `runDbInit` cannot get past its first step offline: fetching
 * connection info is a network call, and failing it returns `err`, which
 * useAppInit turns into a blocking error screen. The replica is on disk the
 * whole time, fully usable.
 *
 * SecureStore because this holds `access_token`. It is the same token the
 * running app already hands to the sync engine, scoped to one user's
 * database and expiring server-side, but it is a credential at rest and
 * belongs in the keychain rather than AsyncStorage.
 */
export const readCachedConnectionInfo =
  async (): Promise<DbConnectionInfo | null> => {
    try {
      const raw = await SecureStore.getItemAsync(CONNECTION_INFO_KEY);
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

export const writeCachedConnectionInfo = async (
  info: DbConnectionInfo
): Promise<void> => {
  try {
    await SecureStore.setItemAsync(CONNECTION_INFO_KEY, JSON.stringify(info));
  } catch {
    // Non-fatal: we lose the offline cold launch, not this session.
  }
};

export const clearCachedConnectionInfo = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(CONNECTION_INFO_KEY);
  } catch {
    // Non-fatal.
  }
};
