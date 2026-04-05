import { cn } from "@bahar/design-system";
import type { FlashcardDirection } from "@bahar/drizzle-user-db-schemas";
import { Card } from "@bahar/web-ui/components/card";
import { Skeleton } from "@bahar/web-ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Clock, Info, Undo2 } from "lucide-react";
import type { FC } from "react";
import { intlFormatDistance } from "@/lib/date";

const RATING_DOT_STYLES: Record<string, string> = {
  again: "bg-muted-foreground",
  hard: "bg-orange-500",
  good: "bg-primary",
  easy: "bg-green-500",
};

const ratingLabel = (rating: string) => {
  switch (rating) {
    case "again":
      return t`Again`;
    case "hard":
      return t`Hard`;
    case "good":
      return t`Good`;
    case "easy":
      return t`Easy`;
    default:
      return rating;
  }
};

export interface RecentReview {
  id: string;
  dictionaryEntryId: string;
  direction: FlashcardDirection;
  word: string;
  translation: string;
  rating: string;
  reviewTimestampMs: number;
}

interface RecentReviewsCardProps {
  reviews: RecentReview[];
  isLoading: boolean;
  onUndo: (review: RecentReview) => void;
  isUndoing: boolean;
}

export const RecentReviewsCard: FC<RecentReviewsCardProps> = ({
  reviews,
  isLoading,
  onUndo,
  isUndoing,
}) => {
  const { i18n } = useLingui();

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton className="h-14 w-full rounded-lg" key={i} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="font-medium text-muted-foreground text-sm">
            <Trans>Recent Reviews</Trans>
          </span>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <Trans>
                Your most recent flashcard reviews. You can undo a review to
                restore the card to its previous state.
              </Trans>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          <Trans>No reviews yet today.</Trans>
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {reviews.map((review) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
              key={review.id}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      RATING_DOT_STYLES[review.rating] ?? "bg-muted-foreground"
                    )}
                  />
                  <span className="truncate font-medium text-sm" dir="rtl">
                    {review.word}
                  </span>
                </div>
                <span className="truncate text-muted-foreground text-xs ltr:ps-4.5 rtl:pe-4.5">
                  {review.translation}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-muted-foreground text-xs">
                  {ratingLabel(review.rating)} ·{" "}
                  {
                    intlFormatDistance(
                      new Date(review.reviewTimestampMs),
                      new Date(),
                      { style: "narrow", locale: i18n.locale }
                    ).label
                  }
                </span>
                <button
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground text-xs transition-colors hover:text-foreground disabled:opacity-50"
                  disabled={isUndoing}
                  onClick={() => onUndo(review)}
                  type="button"
                >
                  <Undo2 className="h-3 w-3" />
                  <Trans>Undo</Trans>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
