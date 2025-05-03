import { Theme, themeAtom } from "@/atoms/theme";
import GithubLogoDark from "../../assets/github-dark.svg";
import GithubLogoLight from "../../assets/github-light.svg";
import { useAtomValue } from "jotai";
import { FC } from "react";
import { cn } from "@bahar/design-system";

export const GithubLogo: FC<{ className?: string }> = ({ className }) => {
  const theme = useAtomValue(themeAtom);
  const isSystemDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const isDark =
    theme === Theme.DARK || (theme === Theme.SYSTEM && isSystemDark);

  return (
    <img
      height={20}
      width={20}
      src={isDark ? GithubLogoDark : GithubLogoLight}
      alt="Github logo"
      className={cn(className)}
    />
  );
};
