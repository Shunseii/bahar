import { cn } from "@bahar/design-system";
import { useAtomValue } from "jotai";
import type { FC } from "react";
import { Theme, themeAtom } from "@/atoms/theme";
import GithubLogoDark from "../../assets/github-dark.svg";
import GithubLogoLight from "../../assets/github-light.svg";

export const GithubLogo: FC<{ className?: string }> = ({ className }) => {
  const theme = useAtomValue(themeAtom);
  const isSystemDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;
  const isDark =
    theme === Theme.DARK || (theme === Theme.SYSTEM && isSystemDark);

  return (
    <img
      alt="Github logo"
      className={cn(className)}
      height={20}
      src={isDark ? GithubLogoDark : GithubLogoLight}
      width={20}
    />
  );
};
