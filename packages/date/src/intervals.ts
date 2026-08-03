import type { IntlFormatDistanceUnit } from "date-fns";
import { intlFormatDistance } from "./index";

export const formatInterval = ({
  due,
  now,
  locale,
  unit,
}: {
  due: Date;
  now: Date;
  locale: string;
  unit?: IntlFormatDistanceUnit;
}) => {
  return intlFormatDistance(due, now, { style: "narrow", locale, unit });
};

/**
 * Progressively finer units a colliding label may be re-rendered at, coarsest
 * first.
 *
 * Every ladder bottoms out at minutes, so a collision can never degrade into a
 * raw second count. Month, quarter and year are deliberately absent: two
 * intervals that both round to "in 3 months" differ by days at most, and
 * spelling that difference out is noise rather than a distinction the user can
 * act on. Minute and second are absent for the same reason there is a floor --
 * there is nothing finer worth showing.
 */
const DEDUPE_LADDERS: Partial<
  Record<Intl.RelativeTimeFormatUnit, IntlFormatDistanceUnit[]>
> = {
  week: ["day", "hour", "minute"],
  day: ["hour", "minute"],
  hour: ["minute"],
};

/**
 * Formats a chronologically ordered list of dates as relative-time labels,
 * re-rendering a pair of adjacent labels at a finer unit when they would
 * otherwise read identically.
 *
 * Used for the flashcard grade buttons, where four dues sit side by side and a
 * user has to be able to tell the options apart.
 *
 * The sweep runs left to right, one adjacent pair at a time, and compares
 * against labels an earlier pair may already have rewritten -- the goal is that
 * what ends up on screen is distinct, not that the first formatting pass was.
 * When a pair can't be separated (identical dues, or a unit with no ladder),
 * the labels are left as they are.
 */
export const formatDistinctIntervals = ({
  dates,
  now,
  locale,
}: {
  dates: Date[];
  now: Date;
  locale: string;
}): string[] => {
  const formatted = dates.map((due) => formatInterval({ due, now, locale }));

  for (let i = 0; i < formatted.length - 1; i++) {
    if (formatted[i].label !== formatted[i + 1].label) continue;

    const ladder = DEDUPE_LADDERS[formatted[i].unit];
    if (!ladder) continue;

    for (const unit of ladder) {
      formatted[i] = formatInterval({ due: dates[i], now, locale, unit });
      formatted[i + 1] = formatInterval({
        due: dates[i + 1],
        now,
        locale,
        unit,
      });

      if (formatted[i].label !== formatted[i + 1].label) break;
    }
  }

  return formatted.map(({ label }) => label);
};
