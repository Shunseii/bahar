import type { SessionFetchOutcome } from "@bahar/auth-core";
// Type-only: pulling the client in at runtime would drag better-auth's ESM
// into every consumer, which jest cannot parse.
import type { authClient } from "@/utils/auth-client";

export type SessionState = ReturnType<typeof authClient.useSession>;

/**
 * Reduces better-auth's session store to the three cases the policy cares
 * about.
 *
 * Its store catches a thrown fetch and sets `data: null` with the error
 * attached, so offline looks identical to signed-out from `data` alone --
 * which is what put a user with a full local replica on the login screen the
 * moment they lost connectivity. Only a 401, or a clean response carrying no
 * user, is the server exercising authority.
 */
export const toOutcome = ({
  data,
  error,
}: SessionState): SessionFetchOutcome => {
  if (error) {
    return error.status === 401
      ? { kind: "loggedOut" }
      : { kind: "unreachable" };
  }

  if (!data?.user) return { kind: "loggedOut" };

  return {
    kind: "authenticated",
    identity: {
      userId: data.user.id,
      email: data.user.email,
      expiresAtMs: new Date(data.session.expiresAt).getTime(),
    },
  };
};
