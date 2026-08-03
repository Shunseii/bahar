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
 *
 * A pair that no unit on the ladder can separate is put back the way it was.
 * Two grades scheduled for the same instant stay equal at every unit, so
 * without the rollback they would walk to the minute floor and render as
 * "in 4,320m" twice -- still identical, and now unreadable as well.
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

    const collided = [formatted[i], formatted[i + 1]] as const;
    let separated = false;

    for (const unit of ladder) {
      formatted[i] = formatInterval({ due: dates[i], now, locale, unit });
      formatted[i + 1] = formatInterval({
        due: dates[i + 1],
        now,
        locale,
        unit,
      });

      if (formatted[i].label !== formatted[i + 1].label) {
        separated = true;
        break;
      }
    }

    if (!separated) {
      formatted[i] = collided[0];
      formatted[i + 1] = collided[1];
    }
  }

  return formatted.map(({ label }) => label);
};
