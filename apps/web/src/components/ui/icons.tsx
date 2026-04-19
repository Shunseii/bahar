import { cn } from "@bahar/design-system";
import { useAtomValue } from "jotai";
import type { FC } from "react";
import { Theme, themeAtom } from "@/atoms/theme";
import AppleLogoDark from "../../assets/apple-dark.svg";
import AppleLogoLight from "../../assets/apple-light.svg";
import GithubLogoDark from "../../assets/github-dark.svg";
import GithubLogoLight from "../../assets/github-light.svg";

const useIsDarkTheme = () => {
  const theme = useAtomValue(themeAtom);
  const isSystemDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  return theme === Theme.DARK || (theme === Theme.SYSTEM && isSystemDark);
};

export const GithubLogo: FC<{ className?: string }> = ({ className }) => {
  const isDark = useIsDarkTheme();

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

export const AppleLogo: FC<{ className?: string }> = ({ className }) => {
  const isDark = useIsDarkTheme();

  return (
    <img
      alt="Apple logo"
      className={cn(className)}
      height={16}
      src={isDark ? AppleLogoDark : AppleLogoLight}
      width={16}
    />
  );
};
