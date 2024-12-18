import { Button } from "./ui/button";
import { GithubLogo } from "./ui/icons";
import { FC, ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export const GithubLoginButton: FC<{ children: ReactNode }> = ({
  children,
}) => {
  return (
    <Button
      className="bg-black hover:bg-black/85 dark:hover:bg-white/85 dark:bg-white flex items-center"
      onClick={async () => {
        await authClient.signIn.social({
          provider: "github",
        });
      }}
    >
      <GithubLogo className="ltr:mr-2 rtl:ml-2" />

      {children}
    </Button>
  );
};
