import { cn } from "@bahar/design-system";
import { Plural, Trans } from "@lingui/react/macro";
import { Check, Flame } from "lucide-react-native";
import type { FC } from "react";
import { Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeColors } from "@/lib/theme";

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
  const colors = useThemeColors();

  if (isLoading) {
    return (
      <Card className="p-5">
        <View className="flex-row items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <View className="gap-1">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-24" />
          </View>
        </View>
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
        "gap-3 p-5",
        reviewedToday
          ? "border-amber-400/30 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/40"
          : "bg-muted/50"
      )}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Flame
            color={reviewedToday ? "#f59e0b" : colors.mutedForeground}
            size={24}
          />
          <View>
            <View className="flex-row items-baseline gap-1.5">
              <Text
                className={cn(
                  "font-bold text-2xl",
                  reviewedToday ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {streakCount.toLocaleString()}
              </Text>
              <Text className="font-medium text-muted-foreground text-sm">
                <Plural
                  one="day streak"
                  other="day streak"
                  value={streakCount}
                />
              </Text>
            </View>
            <Text className="text-muted-foreground text-xs">
              {isBroken && longestStreak > 0 ? (
                <Plural
                  one={`Previous: ${longestStreak} day`}
                  other={`Previous: ${longestStreak} days`}
                  value={longestStreak}
                />
              ) : (
                <Plural
                  one={`Longest: ${longestStreak} day`}
                  other={`Longest: ${longestStreak} days`}
                  value={longestStreak}
                />
              )}
            </Text>
          </View>
        </View>

        {reviewedToday && (
          <View className="flex-row items-center gap-1">
            <Check color="#d97706" size={16} />
            <Text className="font-medium text-amber-600 text-sm dark:text-amber-400">
              <Trans>Goal met!</Trans>
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
};
