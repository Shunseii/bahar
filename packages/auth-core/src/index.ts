/**
 * @bahar/auth-core - Session identity policy shared by web and mobile.
 *
 * Both platforms derived "is the user signed in" purely from a live request,
 * so any network failure read as a sign-out: web threw out of `beforeLoad`
 * before the db layer ran, mobile's session store set `data: null` and the
 * route guard showed the login screen. Either way a user with a complete
 * local replica was locked out of it the moment they lost connectivity.
 *
 * This package holds the decision -- what the effective session is given a
 * fetch outcome and a previously persisted identity. Storage and fetching
 * stay with the platforms; only the policy is shared.
 */

export {
  type CachedIdentity,
  type IdentityStoreAction,
  isSignedOut,
  type ResolvedSession,
  resolveSession,
  type SessionFetchOutcome,
  type SessionSource,
} from "./session";
