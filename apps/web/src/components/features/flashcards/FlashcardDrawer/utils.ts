import { intlFormatDistance } from "date-fns";

/**
 * Formats the interval between two dates into a relative time string.
 */
export const formatInterval = (due: Date, now: Date, locale: string) => {
  const DAYS_IN_MS = 1000 * 60 * 60 * 24;

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / DAYS_IN_MS);
  const dueOnSameDay = diffDays < 1;

  if (dueOnSameDay) {
    return intlFormatDistance(due, now, { style: "narrow", locale });
  }

  return intlFormatDistance(due, now, { style: "narrow", locale, unit: "day" });
};
