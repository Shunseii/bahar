import type { CachedIdentity } from "@bahar/auth-core";

const CACHED_IDENTITY_KEY = "bahar-session-identity";

/**
 * The last identity the server confirmed, kept so a cold start without a
 * network does not read as a sign-out.
 *
 * localStorage rather than the query cache: this has to survive a reload,
 * which is exactly when there is no session to fetch. It holds no
 * credential -- the session cookie is still the only thing that
 * authenticates a request, and the server remains the authority. This only
 * answers "who was signed in here last" while we cannot ask.
 */
export const readCachedIdentity = (): CachedIdentity | null => {
  try {
    const raw = localStorage.getItem(CACHED_IDENTITY_KEY);
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
    // Unparseable or storage blocked (private mode, blocked site data).
    // Treated as "nothing cached" rather than failing the session read.
    return null;
  }
};

export const writeCachedIdentity = (identity: CachedIdentity): void => {
  try {
    localStorage.setItem(CACHED_IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Non-fatal: we lose the offline fallback, not the session itself.
  }
};

export const clearCachedIdentity = (): void => {
  try {
    localStorage.removeItem(CACHED_IDENTITY_KEY);
  } catch {
    // Non-fatal.
  }
};
