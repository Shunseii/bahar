import { TrendingDown, TrendingUp } from "lucide-react-native";
import type { FC, ReactNode } from "react";
import { Text, View } from "react-native";
import { InfoTooltip } from "@/components/progress/InfoTooltip";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  trend?: { text: string; positive: boolean } | null;
  tooltip?: ReactNode;
  isLoading: boolean;
}

export const StatCard: FC<StatCardProps> = ({
  label,
  value,
  detail,
  trend,
  tooltip,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="flex-1 gap-2 p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-3.5 w-24" />
      </Card>
    );
  }

  return (
    <Card className="flex-1 gap-1 p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-muted-foreground text-xs">{label}</Text>
          {tooltip && <InfoTooltip>{tooltip}</InfoTooltip>}
        </View>
        {trend && (
          <View className="flex-row items-center gap-1">
            {trend.positive ? (
              <TrendingUp color="#16a34a" size={14} />
            ) : (
              <TrendingDown color="#dc2626" size={14} />
            )}
            <Text
              className={
                trend.positive
                  ? "font-medium text-emerald-600 text-xs dark:text-emerald-400"
                  : "font-medium text-red-600 text-xs dark:text-red-400"
              }
            >
              {trend.text}
            </Text>
          </View>
        )}
      </View>
      <Text className="font-bold text-3xl text-foreground tracking-tight">
        {value}
      </Text>
      {detail && (
        <Text className="text-muted-foreground text-xs">{detail}</Text>
      )}
    </Card>
  );
};
