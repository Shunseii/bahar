import * as Sentry from "@sentry/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { showOTPFormAtom } from "@/atoms/otp";
import { authClient } from "@/lib/auth-client";
import { resetDb } from "@/lib/db";
import { resetOramaDb } from "@/lib/search";

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

    // Tear the local db down before leaving the authorized layout, and clear
    // the query cache last.
    //
    // Any db-backed query that refetches between signOut and this teardown
    // calls ensureDb, which re-inits, which fetches connection info with no
    // cookie and gets a 401. Queries default to throwOnError, so that failure
    // is kept in the cache -- and when the user signs back in during the same
    // page session the component remounts, the cached error re-throws on
    // render, and they land on the error page from inside the app.
    //
    // Clearing after the teardown discards anything that failed on the way
    // out, and by then the authorized routes are unmounted so nothing is left
    // to repopulate it.
    resetOramaDb();
    await resetDb("logout");

    Sentry.setUser(null);

    navigate({
      to: "/login",
      replace: true,
      resetScroll: true,
    });

    queryClient.clear();
  };

  return { logout };
};
