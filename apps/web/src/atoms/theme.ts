import { atomWithStorage } from "jotai/utils";

export enum Theme {
  DARK = "dark",
  LIGHT = "light",
  SYSTEM = "system",
}

export const getAllThemes = () => {
  return Object.values(Theme);
};

export const updateThemeInDOM = (val: Theme) => {
  const isSystemDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  if (val === Theme.DARK || (val === Theme.SYSTEM && isSystemDark)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

export const themeAtom = atomWithStorage<Theme>(
  "theme",
  (localStorage.getItem("theme") as Theme) ?? Theme.SYSTEM,
  {
    getItem: (key) => {
      const val = localStorage.getItem(key) as Theme;

      updateThemeInDOM(val);

      return val;
    },
    setItem: (key, val) => {
      updateThemeInDOM(val);

      localStorage.setItem(key, val);
    },
    removeItem: (key) => localStorage.removeItem(key),
  }
);

export enum ColorTheme {
  DEFAULT = "default",
  NORD = "nord",
  TOKYO_NIGHT = "tokyo-night",
}

export const getAllColorThemes = () => Object.values(ColorTheme);

export const updateColorThemeInDOM = (theme: ColorTheme) => {
  if (theme === ColorTheme.DEFAULT) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
};

export const colorThemeAtom = atomWithStorage<ColorTheme>(
  "color-theme",
  (localStorage.getItem("color-theme") as ColorTheme) ?? ColorTheme.DEFAULT,
  {
    getItem: (key) => {
      const val =
        (localStorage.getItem(key) as ColorTheme) ?? ColorTheme.DEFAULT;

      updateColorThemeInDOM(val);

      return val;
    },
    setItem: (key, val) => {
      updateColorThemeInDOM(val);

      localStorage.setItem(key, val);
    },
    removeItem: (key) => localStorage.removeItem(key),
  }
);
