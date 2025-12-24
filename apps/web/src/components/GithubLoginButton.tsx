import { Button } from "./ui/button";
import { GithubLogo } from "./ui/icons";
import { FC, ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { Route } from "@/routes/_unauthorized-layout/login/route";

export const GithubLoginButton: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { redirect } = Route.useSearch();
  const redirectUrl = redirect
    ? `${window.location.origin}${redirect}`
    : window.location.origin;

  return (
    <Button
      className="bg-black hover:bg-black/85 dark:hover:bg-white/85 dark:bg-white flex items-center"
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
