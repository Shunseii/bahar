import { useLingui } from "@lingui/react/macro";
import { useCallback, useMemo } from "react";

export const useFormatNumber = () => {
  const { i18n } = useLingui();
  const locale = i18n.locale;
  const isArabic = locale === "ar";

  const formatter = useMemo(() => {
    if (isArabic) {
      return new Intl.NumberFormat("ar-EG", { numberingSystem: "arab" });
    }
    return new Intl.NumberFormat(locale);
  }, [locale, isArabic]);

  const formatNumber = useCallback(
    (num: number) => formatter.format(num),
    [formatter]
  );

  return {
    formatNumber,
  };
};
