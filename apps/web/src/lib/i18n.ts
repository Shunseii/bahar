import { i18n } from "@lingui/core";

export const LOCALES = {
  en: "English",
  ar: "Arabic",
};

export const getLocaleKeys = () => {
  return Object.keys(LOCALES) as TLocale[];
};

export type TLocale = keyof typeof LOCALES;

export const DEFAULT_LOCALE = "en";

export const getLangDir = (lang?: TLocale) => {
  switch (lang) {
    case "ar":
      return "rtl";

    case "en":
    default:
      return "ltr";
  }
};

export async function dynamicActivate(locale: TLocale) {
  // TODO: ideally don't have to hardcode this path
  const { messages } = await import(
    `../../../../packages/config-i18n/locales/${locale}.po`
  );

  i18n.load(locale, messages);
  i18n.activate(locale);

  const dir = getLangDir(locale);

  localStorage.setItem("lang", locale);

  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
}
