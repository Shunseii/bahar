import { Card } from "@bahar/web-ui/components/card";
import { Skeleton } from "@bahar/web-ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { Trans } from "@lingui/react/macro";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import type { FC } from "react";
import { useFormatNumber } from "@/hooks/useFormatNumber";

interface RetentionRateCardProps {
  data:
    | { rate: number | null; trend: number | null; reviewCount: number }
    | undefined;
  isLoading: boolean;
}

export const RetentionRateCard: FC<RetentionRateCardProps> = ({
  data,
  isLoading,
}) => {
  const { formatNumber } = useFormatNumber();

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-3 w-20" />
      </Card>
    );
  }

  const rate = data?.rate;
  const trend = data?.trend;
  const hasData = rate !== null && rate !== undefined;

  const formattedRate = hasData
    ? `${formatNumber(Math.round(rate * 100))}%`
    : "—";

  const trendText = (() => {
    if (trend === null || trend === undefined) return null;
    const pct = formatNumber(Number((trend * 100).toFixed(1)));
    const isPositive = trend >= 0;
    return { pct: isPositive ? `+${pct}%` : `${pct}%`, isPositive };
  })();

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-muted-foreground text-sm">
            <Trans>Retention Rate</Trans>
          </span>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <Trans>
                Percentage of mature card reviews not rated "Again" over the
                last 7 days.
              </Trans>
            </TooltipContent>
          </Tooltip>
        </div>

        {trendText && (
          <div
            className={
              trendText.isPositive
                ? "flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                : "flex items-center gap-1 text-red-600 dark:text-red-400"
            }
          >
            {trendText.isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span className="font-medium text-xs">
              {trendText.pct} <Trans>vs last week</Trans>
            </span>
          </div>
        )}
      </div>

      <span className="font-bold text-4xl tracking-tight">{formattedRate}</span>

      <p className="text-muted-foreground/60 text-xs">
        <Trans>7-day average</Trans>
      </p>
    </Card>
  );
};
