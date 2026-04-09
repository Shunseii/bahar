import { Card } from "@bahar/web-ui/components/card";
import { Skeleton } from "@bahar/web-ui/components/skeleton";
import { Plural, Trans } from "@lingui/react/macro";
import { TrendingUp } from "lucide-react";
import type { FC } from "react";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { InfoTooltip } from "./InfoTooltip";

interface WordsLearnedCardProps {
  data: { learned: number; totalAdded: number; thisWeek: number } | undefined;
  isLoading: boolean;
}

export const WordsLearnedCard: FC<WordsLearnedCardProps> = ({
  data,
  isLoading,
}) => {
  const { formatNumber } = useFormatNumber();

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-3 w-16" />
      </Card>
    );
  }

  const learned = data?.learned ?? 0;
  const totalAdded = data?.totalAdded ?? 0;
  const thisWeek = data?.thisWeek ?? 0;
  const percentage =
    totalAdded > 0 ? Math.round((learned / totalAdded) * 100) : 0;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-muted-foreground text-sm">
            <Trans>Words Learned</Trans>
          </span>
          <InfoTooltip>
            <Trans>
              Words that have graduated from the learning phase into review.
            </Trans>
          </InfoTooltip>
        </div>

        {thisWeek > 0 && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="font-medium text-xs">
              <Trans>+{formatNumber(thisWeek)} this week</Trans>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="font-bold text-4xl tracking-tight">
          {formatNumber(percentage)}%
        </span>
        <span className="text-muted-foreground text-sm">
          <Plural
            one={`${formatNumber(learned)} word`}
            other={`${formatNumber(learned)} words`}
            value={learned}
          />
        </span>
      </div>

      <p className="text-muted-foreground/60 text-xs">
        <Trans>All time</Trans>
      </p>
    </Card>
  );
};
