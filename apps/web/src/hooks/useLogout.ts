import { showOTPFormAtom } from "@/atoms/otp";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import * as Sentry from "@sentry/react";

/**
 * A hook that logs the user out of the application
 * and navigates him back to the login page.
 *
 * Also clears the cached queries.
 */
export const useLogout = () => {
  const navigate = useNavigate({ from: "/" });
  const queryClient = useQueryClient();
  const setShowOTPForm = useSetAtom(showOTPFormAtom);

  const logout = async () => {
    // This would be true if the user logged in
    // during the current session.
    setShowOTPForm(false);

    await queryClient.cancelQueries();

    await authClient.signOut();

    navigate({
      to: "/login",
      replace: true,
      resetScroll: true,
    });

    queryClient.clear();

    Sentry.setUser(null);
  };

  return { logout };
};
