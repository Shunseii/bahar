import { formatDistinctIntervals } from "@bahar/date/intervals";
import { Rating } from "ts-fsrs";

type ReviewRating = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;

type SchedulingDates = Record<ReviewRating, Date>;

/** Ordered shortest-interval-first, which is what the dedup pass expects. */
const GRADES: ReviewRating[] = [
  Rating.Again,
  Rating.Hard,
  Rating.Good,
  Rating.Easy,
];

export const formatScheduleOptions = ({
  dates,
  now,
  locale,
}: {
  dates: SchedulingDates;
  now: Date;
  locale: string;
}): Record<ReviewRating, string> => {
  const labels = formatDistinctIntervals({
    dates: GRADES.map((grade) => dates[grade]),
    now,
    locale,
  });

  return {
    [Rating.Again]: labels[0],
    [Rating.Hard]: labels[1],
    [Rating.Good]: labels[2],
    [Rating.Easy]: labels[3],
  } as Record<ReviewRating, string>;
};
