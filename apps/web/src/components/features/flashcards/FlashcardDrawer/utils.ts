import { type IntlFormatDistanceUnit, isSameMinute } from "date-fns";
import { Rating } from "ts-fsrs";
import { intlFormatDistance } from "@/lib/date";

type ReviewRating = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;

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

const getSmallerUnit = (
  unit: IntlFormatDistanceUnit
): IntlFormatDistanceUnit => {
  switch (unit) {
    case "year":
      return "month";
    case "month":
      return "week";
    case "week":
      return "day";
    case "day":
      return "hour";
    case "hour":
      return "minute";
    case "minute":
      return "second";
    default:
      return "second";
  }
};

type SchedulingDates = Record<ReviewRating, Date>;

export const formatScheduleOptions = ({
  dates,
  now,
  locale,
}: {
  dates: SchedulingDates;
  now: Date;
  locale: string;
}): Record<ReviewRating, string> => {
  const grades: ReviewRating[] = [
    Rating.Again,
    Rating.Hard,
    Rating.Good,
    Rating.Easy,
  ];

  const results = grades.reduce(
    (prev, grade) => {
      prev[grade] = formatInterval({ due: dates[grade], now, locale });

      return prev;
    },
    {} as Record<ReviewRating, ReturnType<typeof formatInterval>>
  );

  for (let i = 0; i < grades.length - 1; i++) {
    const current = grades[i];
    const next = grades[i + 1];

    const currentResult = results[current];
    const currentDate = dates[current];
    const nextResult = results[next];
    const nextDate = dates[next];

    const shouldUseSmallerUnits =
      currentResult.label === nextResult.label &&
      currentResult.unit !== "second" &&
      !isSameMinute(currentDate, nextDate);

    if (shouldUseSmallerUnits) {
      const smallerUnit = getSmallerUnit(results[current].unit);

      results[current] = formatInterval({
        due: dates[current],
        now,
        locale,
        unit: smallerUnit,
      });

      results[next] = formatInterval({
        due: dates[next],
        now,
        locale,
        unit: smallerUnit,
      });
    }
  }

  return {
    [Rating.Again]: results[Rating.Again].label,
    [Rating.Hard]: results[Rating.Hard].label,
    [Rating.Good]: results[Rating.Good].label,
    [Rating.Easy]: results[Rating.Easy].label,
  } as Record<ReviewRating, string>;
};
