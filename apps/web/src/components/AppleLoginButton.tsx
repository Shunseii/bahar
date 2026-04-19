import { Button } from "@bahar/web-ui/components/button";
import type { FC, ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { Route } from "@/routes/_unauthorized-layout/login/route";
import { AppleLogo } from "./ui/icons";

export const AppleLoginButton: FC<{ children: ReactNode }> = ({ children }) => {
  const { redirect } = Route.useSearch();
  const redirectUrl = redirect
    ? `${window.location.origin}${redirect}`
    : window.location.origin;

  return (
    <Button
      className="flex w-full items-center border border-black bg-white text-black hover:bg-neutral-100 dark:border-0 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
      onClick={async () => {
        await authClient.signIn.social({
          provider: "apple",
          callbackURL: redirectUrl,
        });
      }}
    >
      <AppleLogo className="ltr:mr-2 rtl:ml-2" />

      {children}
    </Button>
  );
};
