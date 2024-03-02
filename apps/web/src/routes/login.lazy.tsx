import { Button } from "@/components/ui/button";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Trans } from "@lingui/macro";
import GithubLogo from "../assets/github.svg";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dynamicActivate, getLocaleKeys, LOCALES, TLocale } from "@/lib/i18n";
import { i18n } from "@lingui/core";

const Login = () => {
  return (
    <div className="h-screen dark:bg-slate-950 p-8">
      <Select
        defaultValue={i18n.locale}
        onValueChange={(lng: TLocale) => {
          dynamicActivate(lng);
        }}
      >
        <SelectTrigger className="w-max gap-x-2 dark:text-slate-50">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            {getLocaleKeys().map((lng) => (
              <SelectItem className="cursor-pointer" key={lng} value={lng}>
                {LOCALES[lng]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="h-2/3 flex flex-col justify-center items-center text-center gap-y-8">
        <h1 className="tracking-tight font-bold text-4xl text-white">
          <Trans>Login</Trans>
        </h1>

        <Button asChild>
          <a
            className="flex items-center flex-row rtl:flex-row-reverse"
            href={`${import.meta.env.VITE_API_BASE_URL}/login/github`}
          >
            <img
              height={20}
              width={20}
              src={GithubLogo}
              alt="Github logo"
              className="mr-2"
            />

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
