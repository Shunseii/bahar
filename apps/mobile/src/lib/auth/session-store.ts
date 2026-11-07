import type { CachedIdentity } from "@bahar/auth-core";
import * as SecureStore from "expo-secure-store";

const CACHED_IDENTITY_KEY = "bahar-session-identity";

/**
 * The last identity the server confirmed, kept so a cold start without a
 * network does not read as a sign-out.
 *
 * SecureStore rather than AsyncStorage, to sit alongside the session itself
 * which better-auth's expo client already stores there. It holds no
 * credential of its own -- the stored session remains the only thing that
 * authenticates a request. This answers "who was signed in here last" while
 * the server cannot be asked.
 */
export const readCachedIdentity = async (): Promise<CachedIdentity | null> => {
  try {
    const raw = await SecureStore.getItemAsync(CACHED_IDENTITY_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedIdentity>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.expiresAtMs !== "number"
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      email: parsed.email,
      expiresAtMs: parsed.expiresAtMs,
    };
  } catch {
    // Unparseable, or the keychain is unavailable. Treated as "nothing
    // cached" rather than failing the session read.
    return null;
  }
};

export const writeCachedIdentity = async (
  identity: CachedIdentity
): Promise<void> => {
  try {
    await SecureStore.setItemAsync(
      CACHED_IDENTITY_KEY,
      JSON.stringify(identity)
    );
  } catch {
    // Non-fatal: we lose the offline fallback, not the session itself.
  }
};

export const clearCachedIdentity = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(CACHED_IDENTITY_KEY);
  } catch {
    // Non-fatal.
  }
};
