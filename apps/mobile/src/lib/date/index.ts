import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  type IntlFormatDistanceOptions,
} from "date-fns";
import {
  SECONDS_IN_DAY,
  SECONDS_IN_HOUR,
  SECONDS_IN_MINUTE,
  SECONDS_IN_MONTH,
  SECONDS_IN_QUARTER,
  SECONDS_IN_WEEK,
  SECONDS_IN_YEAR,
} from "./constants";

export function intlFormatDistance(
  laterDate: Date,
  earlierDate: Date,
  options?: IntlFormatDistanceOptions
) {
  let value = 0;
  let unit: Intl.RelativeTimeFormatUnit;

  if (options?.unit) {
    unit = options?.unit;
    if (unit === "second") {
      value = differenceInSeconds(laterDate, earlierDate);
    } else if (unit === "minute") {
      value = differenceInMinutes(laterDate, earlierDate);
    } else if (unit === "hour") {
      value = differenceInHours(laterDate, earlierDate);
    } else if (unit === "day") {
      value = differenceInCalendarDays(laterDate, earlierDate);
    } else if (unit === "week") {
      value = differenceInCalendarWeeks(laterDate, earlierDate);
    } else if (unit === "month") {
      value = differenceInCalendarMonths(laterDate, earlierDate);
    } else if (unit === "year") {
      value = differenceInCalendarYears(laterDate, earlierDate);
    }
  } else {
    const diffInSeconds = differenceInSeconds(laterDate, earlierDate);

    if (Math.abs(diffInSeconds) < SECONDS_IN_MINUTE) {
      value = differenceInSeconds(laterDate, earlierDate);
      unit = "second";
    } else if (Math.abs(diffInSeconds) < SECONDS_IN_HOUR) {
      value = differenceInMinutes(laterDate, earlierDate);
      unit = "minute";
    } else if (
      Math.abs(diffInSeconds) < SECONDS_IN_DAY &&
      Math.abs(differenceInCalendarDays(laterDate, earlierDate)) < 1
    ) {
      value = differenceInHours(laterDate, earlierDate);
      unit = "hour";
    } else if (
      Math.abs(diffInSeconds) < SECONDS_IN_WEEK &&
      (value = differenceInCalendarDays(laterDate, earlierDate)) &&
      Math.abs(value) < 7
    ) {
      unit = "day";
    } else if (Math.abs(diffInSeconds) < SECONDS_IN_MONTH) {
      value = differenceInCalendarWeeks(laterDate, earlierDate);
      unit = "week";
    } else if (Math.abs(diffInSeconds) < SECONDS_IN_QUARTER) {
      value = differenceInCalendarMonths(laterDate, earlierDate);
      unit = "month";
    } else if (Math.abs(diffInSeconds) < SECONDS_IN_YEAR) {
      value = differenceInCalendarYears(laterDate, earlierDate);
      unit = "year";
    } else {
      value = differenceInCalendarYears(laterDate, earlierDate);
      unit = "year";
    }
  }

  const locale = options?.locale === "ar" ? "ar-u-nu-arab" : options?.locale;

  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    ...options,
  });

  return { label: rtf.format(value, unit), unit, value };
}
