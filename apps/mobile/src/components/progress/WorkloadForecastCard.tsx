import { Plural, Trans } from "@lingui/react/macro";
import type { FC } from "react";
import { Text, View } from "react-native";
import { InfoTooltip } from "@/components/progress/InfoTooltip";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkloadForecastCardProps {
  data:
    | {
        days: { label: string; count: number }[];
        tomorrowCount: number;
      }
    | undefined;
  isLoading: boolean;
}

export const WorkloadForecastCard: FC<WorkloadForecastCardProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="gap-3 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  const days = data?.days ?? [];
  const tomorrowCount = data?.tomorrowCount ?? 0;
  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <Card className="gap-3 p-5">
      <View className="flex-row items-center gap-1.5">
        <Text className="font-medium text-muted-foreground text-sm">
          <Trans>Workload Forecast</Trans>
        </Text>
        <InfoTooltip>
          <Trans>
            Predicted number of cards due for review each day over the next
            week.
          </Trans>
        </InfoTooltip>
      </View>

      <View className="flex-row items-baseline gap-2">
        <Text className="font-bold text-3xl text-foreground tracking-tight">
          ~{tomorrowCount.toLocaleString()}
        </Text>
        <Text className="text-muted-foreground text-sm">
          <Plural
            one="review tomorrow"
            other="reviews tomorrow"
            value={tomorrowCount}
          />
        </Text>
      </View>

      <Text className="text-muted-foreground/60 text-xs">
        <Trans>Next 7 days</Trans>
      </Text>

      {days.length > 0 && (
        <View className="flex-row items-end gap-1.5" style={{ height: 100 }}>
          {days.map((day, i) => {
            const barHeight = maxCount > 0 ? (day.count / maxCount) * 70 : 0;
            const isTomorrow = i === 0;

            return (
              <View className="flex-1 items-center gap-1.5" key={day.label}>
                <Text
                  className={
                    isTomorrow
                      ? "font-semibold text-primary text-xs"
                      : "text-muted-foreground text-xs"
                  }
                  style={{ fontSize: 10 }}
                >
                  {day.count}
                </Text>
                <View
                  className={
                    isTomorrow
                      ? "w-full rounded bg-primary"
                      : "w-full rounded bg-primary/20"
                  }
                  style={{
                    height: Math.max(barHeight, 4),
                  }}
                />
                <Text
                  className={
                    isTomorrow
                      ? "font-semibold text-primary"
                      : "text-muted-foreground"
                  }
                  style={{ fontSize: 10 }}
                >
                  {day.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
};
