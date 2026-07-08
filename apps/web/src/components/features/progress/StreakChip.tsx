import { cn } from "@bahar/design-system";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import type { FC } from "react";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { progressTable } from "@/lib/db/operations";

interface StreakChipProps {
  className?: string;
}

const StreakChip: FC<StreakChipProps> = ({ className }) => {
  const { formatNumber } = useFormatNumber();
  const { data } = useQuery({
    queryFn: progressTable.streak.query,
    ...progressTable.streak.cacheOptions,
  });

  const streakCount = data?.streakCount ?? 0;
  const reviewedToday = data?.reviewedToday ?? false;

  if (streakCount === 0) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold text-xs tabular-nums",
        reviewedToday
          ? "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
          : "border-border bg-muted text-muted-foreground",
        className
      )}
      title={
        reviewedToday
          ? `${formatNumber(streakCount)}-day streak — reviewed today`
          : `${formatNumber(streakCount)}-day streak — review to keep it alive`
      }
    >
      <Flame
        className={cn(
          "h-3.5 w-3.5",
          reviewedToday
            ? "fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
            : "text-muted-foreground"
        )}
      />
      <span>{formatNumber(streakCount)}</span>
    </div>
  );
};

export default StreakChip;
