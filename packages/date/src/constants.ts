/**
 * Date constants used by the vendored `intlFormatDistance`.
 *
 * These mirror `date-fns/constants`, which isn't part of the package's public
 * entry points.
 */

/**
 * One year equals 365.2425 days: a leap year occurs every 4 years, except for
 * years divisible by 100 and not by 400.
 */
export const DAYS_IN_YEAR = 365.2425;

export const SECONDS_IN_HOUR = 3600;
export const SECONDS_IN_MINUTE = 60;
export const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24;
export const SECONDS_IN_WEEK = SECONDS_IN_DAY * 7;
export const SECONDS_IN_YEAR = SECONDS_IN_DAY * DAYS_IN_YEAR;
export const SECONDS_IN_MONTH = SECONDS_IN_YEAR / 12;
export const SECONDS_IN_QUARTER = SECONDS_IN_MONTH * 3;
