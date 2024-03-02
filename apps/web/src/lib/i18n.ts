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

export async function dynamicActivate(locale: TLocale) {
  const { messages } = await import(`../locales/${locale}.po`);

  i18n.load(locale, messages);
  i18n.activate(locale);

  localStorage.setItem("lang", locale);

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}
