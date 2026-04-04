import { Card } from "@bahar/web-ui/components/card";
import { Skeleton } from "@bahar/web-ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowRight, Info, PencilLine } from "lucide-react";
import type { FC } from "react";

interface DifficultWordsCardProps {
  data:
    | {
        total: number;
        words: {
          word: string;
          translation: string;
          entryId: string;
          bothDirections: boolean;
        }[];
      }
    | undefined;
  isLoading: boolean;
}

export const DifficultWordsCard: FC<DifficultWordsCardProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
      </Card>
    );
  }

  const total = data?.total ?? 0;
  const words = data?.words ?? [];

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-muted-foreground text-sm">
            <Trans>Difficult Words</Trans>
          </span>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <Trans>
                Words you find hardest based on your review history. As you
                improve, words will naturally drop off this list.
              </Trans>
            </TooltipContent>
          </Tooltip>
        </div>

        {total > 0 && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground text-xs">
            {total} <Trans>total</Trans>
          </span>
        )}
      </div>

      {words.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          <Trans>No difficult words yet.</Trans>
        </p>
      ) : (
        <>
          <p className="text-muted-foreground/60 text-xs">
            <Trans>Top 3 most difficult</Trans>
          </p>

          <div className="flex flex-col gap-1.5">
            {words.map((w) => (
              <div
                className="flex items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2.5 dark:bg-red-950/30"
                key={w.entryId}
              >
                <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1.5">
                    {w.bothDirections && (
                      <ArrowLeftRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                    )}
                    <span className="truncate font-semibold text-sm" dir="rtl">
                      {w.word}
                    </span>
                  </div>
                  <span className="truncate text-muted-foreground text-xs">
                    {w.translation}
                  </span>
                </div>

                <Link
                  className="shrink-0"
                  params={{ wordId: w.entryId }}
                  to="/dictionary/edit/$wordId"
                >
                  <PencilLine className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors hover:text-foreground" />
                </Link>
              </div>
            ))}
          </div>

          <Link
            className="text-center font-medium text-primary text-sm hover:underline"
            search={{ sort: "difficulty" }}
            to="/"
          >
            <Trans>View all in dictionary</Trans>{" "}
            <ArrowRight className="inline h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </Card>
  );
};
