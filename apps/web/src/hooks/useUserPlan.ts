import { authClient } from "@/lib/auth-client";

export const useUserPlan = () => {
  const { data: userData } = authClient.useSession();

  const isProUser =
    userData?.user.plan === "pro" &&
    !!userData.user.subscriptionStatus &&
    userData.user.subscriptionStatus !== "canceled";

  return {
    isProUser,
    isFreeUser: !isProUser,
  };
};
