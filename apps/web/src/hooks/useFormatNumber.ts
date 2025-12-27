import { useLingui } from "@lingui/react/macro";
import { useCallback, useMemo } from "react";

/**
 * Custom hook for locale-specific formatting of numbers.
 */
export const useFormatNumber = () => {
  const { i18n } = useLingui();
  const locale = i18n.locale;
  const isArabic = locale === "ar";

  const formatter = useMemo(() => {
    if (isArabic) {
      return new Intl.NumberFormat("ar", { numberingSystem: "arab" });
    }
    return new Intl.NumberFormat(locale);
  }, [locale, isArabic]);

  const formatNumber = useCallback(
    (num: number) => formatter.format(num),
    [formatter]
  );

  const formatElapsedTime = useCallback(
    (nanoseconds: bigint | number) => {
      const ns = Number(nanoseconds);
      const decimalFormatter = new Intl.NumberFormat(locale, {
        numberingSystem: isArabic ? "arab" : undefined,
        maximumFractionDigits: 2,
      });

      if (ns < 1000) {
        return `${decimalFormatter.format(ns)}ns`;
      }
      if (ns < 1_000_000) {
        return `${decimalFormatter.format(ns / 1000)}μs`;
      }
      if (ns < 1_000_000_000) {
        return `${decimalFormatter.format(ns / 1_000_000)}ms`;
      }
      return `${decimalFormatter.format(ns / 1_000_000_000)}s`;
    },
    [locale, isArabic]
  );

  return {
    /**
     * Formats a number to the locale-specific number format.
     */
    formatNumber,

    /**
     * Formats a number to the locale-specific elapsed time format.
     */
    formatElapsedTime,
  };
};
