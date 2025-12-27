import type { FC, ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { Route } from "@/routes/_unauthorized-layout/login/route";
import { Button } from "./ui/button";
import { GithubLogo } from "./ui/icons";

export const GithubLoginButton: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { redirect } = Route.useSearch();
  const redirectUrl = redirect
    ? `${window.location.origin}${redirect}`
    : window.location.origin;

  return (
    <Button
      className="flex items-center bg-black hover:bg-black/85 dark:bg-white dark:hover:bg-white/85"
      onClick={async () => {
        await authClient.signIn.social({
          provider: "github",
          callbackURL: redirectUrl,
        });
      }}
    >
      <GithubLogo className="ltr:mr-2 rtl:ml-2" />

      {children}
    </Button>
  );
};
