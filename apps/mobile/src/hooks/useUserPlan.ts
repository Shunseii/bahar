import { authClient } from "@/utils/auth-client";

export const useUserPlan = () => {
  const { data: userData } = authClient.useSession();

  const activeStatuses = ["active", "trialing", "past_due"];
  const isProUser =
    userData?.user.plan === "pro" &&
    activeStatuses.includes(userData.user.subscriptionStatus ?? "");

  const isAnonymous = userData?.user.isAnonymous ?? false;

  return {
    isProUser,
    isFreeUser: !isProUser,
    isAnonymous,
  };
};
