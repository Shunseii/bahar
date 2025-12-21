/**
 * Theme utilities for getting native-compatible colors from the design system.
 */

import { useColorScheme } from "react-native";
import { cssVariables } from "@bahar/design-system/theme";

/**
 * Converts HSL string (e.g., "221.2 83.2% 53.3%") to hex color.
 */
const hslToHex = (hslString: string): string => {
  const parts = hslString.split(" ");
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number): string => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Color keys that exist in both light and dark themes
type ThemeColorKey =
  | "--background"
  | "--foreground"
  | "--card"
  | "--card-foreground"
  | "--popover"
  | "--popover-foreground"
  | "--primary"
  | "--primary-foreground"
  | "--secondary"
  | "--secondary-foreground"
  | "--muted"
  | "--muted-foreground"
  | "--accent"
  | "--accent-foreground"
  | "--destructive"
  | "--destructive-foreground"
  | "--success"
  | "--success-foreground"
  | "--warning"
  | "--warning-foreground"
  | "--border"
  | "--input"
  | "--ring";

/**
 * Gets a color from the theme as a hex string.
 */
export const getThemeColor = (
  colorScheme: "light" | "dark" | null | undefined,
  key: ThemeColorKey
): string => {
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const vars = cssVariables[scheme] as Record<ThemeColorKey, string>;
  return hslToHex(vars[key]);
};

/**
 * Hook that returns theme colors as hex values.
 */
export const useThemeColors = () => {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const vars = cssVariables[scheme];

  return {
    background: hslToHex(vars["--background"]),
    foreground: hslToHex(vars["--foreground"]),
    card: hslToHex(vars["--card"]),
    cardForeground: hslToHex(vars["--card-foreground"]),
    primary: hslToHex(vars["--primary"]),
    primaryForeground: hslToHex(vars["--primary-foreground"]),
    secondary: hslToHex(vars["--secondary"]),
    secondaryForeground: hslToHex(vars["--secondary-foreground"]),
    muted: hslToHex(vars["--muted"]),
    mutedForeground: hslToHex(vars["--muted-foreground"]),
    accent: hslToHex(vars["--accent"]),
    accentForeground: hslToHex(vars["--accent-foreground"]),
    destructive: hslToHex(vars["--destructive"]),
    destructiveForeground: hslToHex(vars["--destructive-foreground"]),
    success: hslToHex(vars["--success"]),
    successForeground: hslToHex(vars["--success-foreground"]),
    warning: hslToHex(vars["--warning"]),
    warningForeground: hslToHex(vars["--warning-foreground"]),
    border: hslToHex(vars["--border"]),
    input: hslToHex(vars["--input"]),
    ring: hslToHex(vars["--ring"]),
  };
};
