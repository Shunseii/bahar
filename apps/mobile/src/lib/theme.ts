/**
 * Theme utilities using UniWind's CSS variable access.
 *
 * Colors are resolved once via ThemeColorsProvider and shared
 * through React context to avoid calling useCSSVariable in every component.
 */

import { createContext, useContext } from "react";
import { useCSSVariable } from "uniwind";

export type ThemeColors = ReturnType<typeof useResolvedThemeColors>;

/**
 * Internal hook that resolves all CSS variables.
 * Should only be called once in ThemeColorsProvider.
 */
export const useResolvedThemeColors = () => {
  return {
    background: useCSSVariable("--color-background") as string,
    foreground: useCSSVariable("--color-foreground") as string,
    card: useCSSVariable("--color-card") as string,
    cardForeground: useCSSVariable("--color-card-foreground") as string,
    popover: useCSSVariable("--color-popover") as string,
    popoverForeground: useCSSVariable("--color-popover-foreground") as string,
    primary: useCSSVariable("--color-primary") as string,
    primaryForeground: useCSSVariable("--color-primary-foreground") as string,
    secondary: useCSSVariable("--color-secondary") as string,
    secondaryForeground: useCSSVariable(
      "--color-secondary-foreground"
    ) as string,
    muted: useCSSVariable("--color-muted") as string,
    mutedForeground: useCSSVariable("--color-muted-foreground") as string,
    accent: useCSSVariable("--color-accent") as string,
    accentForeground: useCSSVariable("--color-accent-foreground") as string,
    destructive: useCSSVariable("--color-destructive") as string,
    destructiveForeground: useCSSVariable(
      "--color-destructive-foreground"
    ) as string,
    success: useCSSVariable("--color-success") as string,
    successForeground: useCSSVariable("--color-success-foreground") as string,
    warning: useCSSVariable("--color-warning") as string,
    warningForeground: useCSSVariable("--color-warning-foreground") as string,
    border: useCSSVariable("--color-border") as string,
    input: useCSSVariable("--color-input") as string,
    ring: useCSSVariable("--color-ring") as string,
  };
};

const ThemeColorsContext = createContext<ThemeColors | null>(null);

export const ThemeColorsProvider = ThemeColorsContext.Provider;

/**
 * Hook that returns theme colors. Reads from context (O(1)) instead
 * of resolving CSS variables on every call.
 */
export const useThemeColors = (): ThemeColors => {
  const colors = useContext(ThemeColorsContext);
  if (!colors) {
    throw new Error("useThemeColors must be used within ThemeColorsProvider");
  }
  return colors;
};
