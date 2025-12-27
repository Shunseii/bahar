import { useLingui } from "@lingui/react/macro";
import type { TLocale } from "@/lib/i18n";

export const useDir = () => {
  const { i18n } = useLingui();

  const lang = i18n.locale as TLocale;

  return lang === "ar" ? "rtl" : "ltr";
};
