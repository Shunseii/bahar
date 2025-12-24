/**
 * Theme utilities using UniWind's CSS variable access.
 */

import { useCSSVariable } from "uniwind";

/**
 * Hook that returns theme colors from CSS variables.
 */
export const useThemeColors = () => {
  return {
    background: useCSSVariable("--color-background"),
    foreground: useCSSVariable("--color-foreground"),
    card: useCSSVariable("--color-card"),
    cardForeground: useCSSVariable("--color-card-foreground"),
    popover: useCSSVariable("--color-popover"),
    popoverForeground: useCSSVariable("--color-popover-foreground"),
    primary: useCSSVariable("--color-primary"),
    primaryForeground: useCSSVariable("--color-primary-foreground"),
    secondary: useCSSVariable("--color-secondary"),
    secondaryForeground: useCSSVariable("--color-secondary-foreground"),
    muted: useCSSVariable("--color-muted"),
    mutedForeground: useCSSVariable("--color-muted-foreground"),
    accent: useCSSVariable("--color-accent"),
    accentForeground: useCSSVariable("--color-accent-foreground"),
    destructive: useCSSVariable("--color-destructive"),
    destructiveForeground: useCSSVariable("--color-destructive-foreground"),
    success: useCSSVariable("--color-success"),
    successForeground: useCSSVariable("--color-success-foreground"),
    warning: useCSSVariable("--color-warning"),
    warningForeground: useCSSVariable("--color-warning-foreground"),
    border: useCSSVariable("--color-border"),
    input: useCSSVariable("--color-input"),
    ring: useCSSVariable("--color-ring"),
  };
};
