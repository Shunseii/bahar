import { Card } from "@bahar/web-ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@bahar/web-ui/components/chart";
import { Skeleton } from "@bahar/web-ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { Plural, Trans } from "@lingui/react/macro";
import { Info } from "lucide-react";
import type { FC } from "react";
import { Bar, BarChart, XAxis } from "recharts";

interface WorkloadForecastCardProps {
  data:
    | {
        days: { label: string; count: number }[];
        tomorrowCount: number;
      }
    | undefined;
  isLoading: boolean;
}

const chartConfig = {
  count: {
    label: "Reviews",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

export const WorkloadForecastCard: FC<WorkloadForecastCardProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  const days = data?.days ?? [];
  const tomorrowCount = Number(data?.tomorrowCount ?? 0);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-muted-foreground text-sm">
          <Trans>Workload Forecast</Trans>
        </span>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <Trans>
              Predicted number of cards due for review each day over the next
              week.
            </Trans>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-bold text-4xl tracking-tight">
          ~{tomorrowCount}
        </span>
        <span className="text-muted-foreground text-sm">
          <Plural
            one="review tomorrow"
            other="reviews tomorrow"
            value={tomorrowCount}
          />
        </span>
      </div>

      <p className="text-muted-foreground/60 text-xs">
        <Trans>Next 7 days</Trans>
      </p>

      {days.length > 0 && (
        <ChartContainer className="aspect-auto h-16" config={chartConfig}>
          <BarChart accessibilityLayer data={days}>
            <XAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={<ChartTooltipContent hideIndicator />}
              cursor={false}
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={3} />
          </BarChart>
        </ChartContainer>
      )}
    </Card>
  );
};
