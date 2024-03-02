import { Button } from "@/components/ui/button";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Trans } from "@lingui/macro";
import { ThemeMenu } from "@/components/ThemeMenu";
import { LanguageMenu } from "@/components/LanguageMenu";
import { GithubLogo } from "@/components/ui/icons";

const Login = () => {
  return (
    <div className="h-screen dark:bg-slate-950 p-8">
      <div className="flex flex-row justify-between rtl:flex-row-reverse">
        <ThemeMenu />
        <LanguageMenu />
      </div>

      <div className="h-2/3 flex flex-col justify-center items-center text-center gap-y-8">
        <h1 className="tracking-tight font-bold text-4xl dark:text-white">
          <Trans>Login</Trans>
        </h1>

        <Button asChild>
          <a
            className="flex items-center flex-row rtl:flex-row-reverse"
            href={`${import.meta.env.VITE_API_BASE_URL}/login/github`}
          >
            <GithubLogo className="mr-2" />

            <Trans>Login with GitHub</Trans>
          </a>
        </Button>
      </div>
    </div>
  );
};

export const Route = createLazyFileRoute("/login")({
  component: Login,
});
