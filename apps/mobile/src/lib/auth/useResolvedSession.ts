import {
  type CachedIdentity,
  type ResolvedSession,
  resolveSession,
} from "@bahar/auth-core";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "@/utils/auth-client";
import { toOutcome } from "./session-outcome";
import {
  clearCachedIdentity,
  readCachedIdentity,
  writeCachedIdentity,
} from "./session-store";

/**
 * The effective session: live when the server answered, the persisted
 * identity when it could not be reached, and nothing once a sign-out is
 * confirmed.
 *
 * `isResolving` stays true until both better-auth has settled and the
 * persisted identity has been read off the keychain -- the read is async, so
 * routing before it lands would briefly show the auth screens to a user who
 * is in fact signed in.
 */
export const useResolvedSession = (): {
  session: ResolvedSession | null;
  isResolving: boolean;
} => {
  const sessionState = authClient.useSession();
  const { isPending } = sessionState;

  // `undefined` means "not read yet", distinct from a read that found
  // nothing.
  const [cached, setCached] = useState<CachedIdentity | null | undefined>(
    undefined
  );

  useEffect(() => {
    let active = true;

    readCachedIdentity().then((identity) => {
      if (active) setCached(identity);
    });

    return () => {
      active = false;
    };
  }, []);

  const outcome = useMemo(() => toOutcome(sessionState), [sessionState]);

  const session = useMemo(() => {
    if (isPending || cached === undefined) return null;

    return resolveSession({ outcome, cached, nowMs: Date.now() });
  }, [isPending, cached, outcome]);

  useEffect(() => {
    if (!session) return;

    if (session.store === "write") {
      void writeCachedIdentity(session.identity);
    } else if (session.store === "clear") {
      void clearCachedIdentity();
    }
  }, [session]);

  return { session, isResolving: session === null };
};
