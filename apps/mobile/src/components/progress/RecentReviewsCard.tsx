import { cn } from "@bahar/design-system";
import type { FlashcardDirection } from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { formatDistanceToNow } from "date-fns";
import { Clock, Undo2 } from "lucide-react-native";
import type { FC } from "react";
import { Pressable, Text, View } from "react-native";
import { InfoTooltip } from "@/components/progress/InfoTooltip";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeColors } from "@/lib/theme";

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
  onUndo?: (review: RecentReview) => void;
  isUndoing?: boolean;
}

export const RecentReviewsCard: FC<RecentReviewsCardProps> = ({
  reviews,
  isLoading,
  onUndo,
  isUndoing,
}) => {
  const colors = useThemeColors();

  if (isLoading) {
    return (
      <Card className="gap-4 p-5">
        <Skeleton className="h-4 w-32" />
        <View className="gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton className="h-14 w-full rounded-lg" key={i} />
          ))}
        </View>
      </Card>
    );
  }

  return (
    <Card className="gap-3.5 p-5">
      <View className="flex-row items-center gap-1.5">
        <Clock color={colors.mutedForeground} size={14} />
        <Text className="font-medium text-muted-foreground text-sm">
          <Trans>Recent Reviews</Trans>
        </Text>
        <InfoTooltip>
          <Trans>
            Your most recent flashcard reviews. You can undo a review to restore
            the card to its previous state.
          </Trans>
        </InfoTooltip>
      </View>

      {reviews.length === 0 ? (
        <Text className="text-muted-foreground text-sm">
          <Trans>No reviews yet today.</Trans>
        </Text>
      ) : (
        <View className="gap-1">
          {reviews.map((review) => (
            <View
              className="gap-1 rounded-lg bg-muted/50 px-3 py-2"
              key={review.id}
            >
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-2">
                  <View
                    className={cn(
                      "h-2 w-2 rounded-full",
                      RATING_DOT_STYLES[review.rating] ?? "bg-muted-foreground"
                    )}
                  />
                  <Text className="text-muted-foreground text-xs">
                    {ratingLabel(review.rating)} ·{" "}
                    {formatDistanceToNow(new Date(review.reviewTimestampMs), {
                      addSuffix: true,
                    })}
                  </Text>
                </View>

                {onUndo && (
                  <Pressable
                    className="flex-row items-center gap-1 rounded-md border border-border px-2 py-1"
                    disabled={isUndoing}
                    onPress={() => onUndo(review)}
                    style={{ opacity: isUndoing ? 0.5 : 1 }}
                  >
                    <Undo2 color={colors.mutedForeground} size={12} />
                    <Text className="text-muted-foreground text-xs">
                      <Trans>Undo</Trans>
                    </Text>
                  </Pressable>
                )}
              </View>

              <View className="min-w-0 gap-0.5">
                <Text
                  className="font-medium text-foreground text-sm"
                  style={{ writingDirection: "rtl", textAlign: "left" }}
                >
                  {review.word}
                </Text>
                <Text
                  className="text-muted-foreground text-xs"
                  style={{ writingDirection: "ltr" }}
                >
                  {review.translation}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};
