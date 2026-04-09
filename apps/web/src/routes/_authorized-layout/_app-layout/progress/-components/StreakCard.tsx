import { cn } from "@bahar/design-system";
import { Card } from "@bahar/web-ui/components/card";
import { Skeleton } from "@bahar/web-ui/components/skeleton";
import { Plural, Trans } from "@lingui/react/macro";
import { Check, Flame } from "lucide-react";
import type { FC } from "react";
import { useFormatNumber } from "@/hooks/useFormatNumber";

interface StreakCardProps {
  data:
    | {
        streakCount: number;
        longestStreak: number;
        reviewedToday: boolean;
      }
    | undefined;
  isLoading: boolean;
}

export const StreakCard: FC<StreakCardProps> = ({ data, isLoading }) => {
  const { formatNumber } = useFormatNumber();

  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      </Card>
    );
  }

  const reviewedToday = data?.reviewedToday ?? false;
  const streakCount = data?.streakCount ?? 0;
  const longestStreak = data?.longestStreak ?? 0;
  const isBroken = !reviewedToday && streakCount === 0;

  return (
    <Card
      className={cn(
        "flex flex-col gap-3 p-5",
        reviewedToday
          ? "border-amber-400/30 bg-linear-to-b from-amber-50 to-amber-100/50 dark:border-amber-500/20 dark:from-amber-950/40 dark:to-amber-900/20"
          : "bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame
            className={cn(
              "h-6 w-6",
              reviewedToday
                ? "text-amber-500 dark:text-amber-400"
                : "text-muted-foreground"
            )}
          />
          <div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "font-bold text-2xl",
                  !reviewedToday && "text-muted-foreground"
                )}
              >
                {formatNumber(streakCount)}
              </span>
              <span className="font-medium text-muted-foreground text-sm">
                <Plural
                  one="day streak"
                  other="day streak"
                  value={streakCount}
                />
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {isBroken && longestStreak > 0 ? (
                <Plural
                  one={`Previous: ${formatNumber(longestStreak)} day`}
                  other={`Previous: ${formatNumber(longestStreak)} days`}
                  value={longestStreak}
                />
              ) : (
                <Plural
                  one={`Longest: ${formatNumber(longestStreak)} day`}
                  other={`Longest: ${formatNumber(longestStreak)} days`}
                  value={longestStreak}
                />
              )}
            </p>
          </div>
        </div>

        {reviewedToday ? (
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Check className="h-4 w-4" />
            <span className="font-medium text-sm">
              <Trans>Goal met!</Trans>
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
};
