import { Card } from "@bahar/web-ui/components/card";
import { Skeleton } from "@bahar/web-ui/components/skeleton";
import { Trans } from "@lingui/react/macro";
import { TrendingUp } from "lucide-react";
import type { FC } from "react";

interface WordsAddedCardProps {
  data: { total: number; thisWeek: number } | undefined;
  isLoading: boolean;
}

export const WordsAddedCard: FC<WordsAddedCardProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="flex flex-col justify-center p-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-9 w-16" />
        <Skeleton className="mt-1 h-4 w-28" />
      </Card>
    );
  }

  const total = data?.total ?? 0;
  const thisWeek = data?.thisWeek ?? 0;

  return (
    <Card className="flex justify-between p-5">
      <div className="flex flex-col justify-center">
        <p className="text-muted-foreground text-sm">
          <Trans>Words Added</Trans>
        </p>
        <span className="font-bold text-3xl">{total}</span>
      </div>
      {thisWeek > 0 && (
        <div className="flex h-max items-center gap-1 text-emerald-600">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="font-medium text-xs">
            <Trans>+{thisWeek} this week</Trans>
          </span>
        </div>
      )}
    </Card>
  );
};
