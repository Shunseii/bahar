import { cn } from "@bahar/design-system";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react-native";
import type { FC } from "react";
import { Text, View } from "react-native";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { progressTable } from "@/lib/db/operations/progress";

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
    <View
      className={cn(
        "flex-row items-center gap-1 rounded-2xl px-2.5 py-1",
        reviewedToday
          ? "border border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40"
          : "border border-border bg-muted",
        className
      )}
    >
      <Flame
        color={reviewedToday ? "#F59E0B" : "#9CA3AF"}
        fill={reviewedToday ? "#F59E0B" : "transparent"}
        size={14}
      />
      <Text
        className={cn(
          "font-semibold text-xs",
          reviewedToday
            ? "text-amber-800 dark:text-amber-300"
            : "text-muted-foreground"
        )}
      >
        {formatNumber(streakCount)}
      </Text>
    </View>
  );
};

export default StreakChip;
