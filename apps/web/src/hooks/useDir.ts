import { TLocale } from "@/lib/i18n";
import { useLingui } from "@lingui/react/macro";

export const useDir = () => {
  const { i18n } = useLingui();

  const lang = i18n.locale as TLocale;

  return lang === "ar" ? "rtl" : "ltr";
};
