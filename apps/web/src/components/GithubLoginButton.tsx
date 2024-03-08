import { Button } from "./ui/button";
import { GithubLogo } from "./ui/icons";
import { FC, ReactNode } from "react";

export const GithubLoginButton: FC<{ children: ReactNode }> = ({
  children,
}) => {
  return (
    <Button
      asChild
      className="bg-black hover:bg-black/85 dark:hover:bg-white/85 dark:bg-white"
    >
      <a
        className="flex items-center"
        href={`${import.meta.env.VITE_API_BASE_URL}/login/github`}
      >
        <GithubLogo className="ltr:mr-2 rtl:ml-2" />

        {children}
      </a>
    </Button>
  );
};
