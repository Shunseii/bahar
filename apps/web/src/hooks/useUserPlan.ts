import { authClient } from "@/lib/auth-client";

/**
 * - `pro` / `free`: the server answered with the user's plan.
 * - `offline`: the session check failed, so the plan is unknown. Offline the
 *   app still has the signed-in identity but not the plan, and every
 *   plan-gated feature needs the server anyway -- so this means "needs a
 *   connection", not "free".
 * - `loading`: the first session check hasn't settled yet.
 */
export type PlanStatus = "pro" | "free" | "offline" | "loading";

export const useUserPlan = () => {
  const { data: userData, error } = authClient.useSession();
  const user = userData?.user;

  const activeStatuses = ["active", "trialing", "past_due"];
  const isPro =
    user?.plan === "pro" &&
    activeStatuses.includes(user.subscriptionStatus ?? "");

  let planStatus: PlanStatus = "loading";
  if (user) planStatus = isPro ? "pro" : "free";
  else if (error) planStatus = "offline";

  return {
    planStatus,
    isProUser: planStatus === "pro",
    isFreeUser: planStatus === "free",
    needsConnection: planStatus === "offline",
  };
};
