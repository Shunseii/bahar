import { cn } from "@bahar/design-system";
import type { SelectFlashcard } from "@bahar/drizzle-user-db-schemas";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Lock, Timer } from "lucide-react-native";
import type { FC } from "react";
import { Text, View } from "react-native";
import { useUserPlan } from "@/hooks/useUserPlan";
import { intlFormatDistance } from "@/lib/date";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";
import { useThemeColors } from "@/lib/theme";
import { api } from "@/utils/api";

const RATING_DOT_COLORS: Record<string, string> = {
  again: "bg-muted-foreground",
  hard: "bg-orange-500",
  good: "bg-primary",
  easy: "bg-green-500",
};

const MAX_VISIBLE_DOTS = 10;

const formatNextReview = ({
  due,
}: {
  due: string;
}): { label: string; isOverdue: boolean } => {
  const dueDate = new Date(due);
  const now = new Date();
  const isOverdue = dueDate.getTime() <= now.getTime();

  if (isOverdue) {
    return { label: t`overdue`, isOverdue: true };
  }

  return {
    label: intlFormatDistance(dueDate, now).label,
    isOverdue: false,
  };
};

const RatingLegend: FC = () => {
  return (
    <View className="flex-row items-center gap-3">
      {Object.entries(RATING_DOT_COLORS).map(([rating, style]) => (
        <View className="flex-row items-center gap-1" key={rating}>
          <View className={cn("size-2.5 rounded-full", style)} />
          <Text className="text-muted-foreground text-xs capitalize">
            {rating === "again"
              ? t`Again`
              : rating === "hard"
                ? t`Hard`
                : rating === "good"
                  ? t`Good`
                  : t`Easy`}
          </Text>
        </View>
      ))}
    </View>
  );
};

const DirectionTimeline: FC<{
  revlogs: { rating: string | null; reviewTimestampMs: number }[];
  flashcard?: Pick<SelectFlashcard, "due" | "lapses"> | undefined;
  label?: string;
}> = ({ revlogs, flashcard, label }) => {
  const reviewCount = revlogs.length;
  const lapseCount = flashcard?.lapses ?? 0;
  const lastReviewMs =
    revlogs.length > 0 ? revlogs[revlogs.length - 1].reviewTimestampMs : null;

  const metaParts: string[] = [];
  metaParts.push(
    plural(reviewCount, {
      one: `${reviewCount} review`,
      other: `${reviewCount} reviews`,
    })
  );
  metaParts.push(
    plural(lapseCount, {
      one: `${lapseCount} lapse`,
      other: `${lapseCount} lapses`,
    })
  );

  if (lastReviewMs) {
    metaParts.push(
      intlFormatDistance(new Date(lastReviewMs), new Date()).label
    );
  }

  const showOldestLatest = reviewCount > 1;
  const visibleRevlogs =
    revlogs.length > MAX_VISIBLE_DOTS
      ? revlogs.slice(revlogs.length - MAX_VISIBLE_DOTS)
      : revlogs;

  return (
    <View className="gap-1.5">
      {reviewCount > 0 && (
        <View className="flex-row flex-wrap items-center gap-1">
          {showOldestLatest && (
            <Text className="text-muted-foreground/60 text-xs">
              <Trans>Oldest</Trans>
            </Text>
          )}
          {revlogs.length > MAX_VISIBLE_DOTS && (
            <Text className="text-muted-foreground text-xs">…</Text>
          )}
          {visibleRevlogs.map((r, i) => (
            <View
              className={cn(
                "size-2.5 rounded-full",
                RATING_DOT_COLORS[r.rating ?? "good"] ?? "bg-primary"
              )}
              key={i}
            />
          ))}
          {showOldestLatest && (
            <Text className="text-muted-foreground/60 text-xs">
              <Trans>Latest</Trans>
            </Text>
          )}
        </View>
      )}

      {(label || reviewCount > 0) && (
        <View className="flex-row items-center justify-between">
          {label && (
            <Text className="font-semibold text-foreground text-xs">
              {label}
            </Text>
          )}
          {reviewCount > 0 && (
            <Text className="text-muted-foreground text-xs">
              {metaParts.join(" · ")}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const NextReviewSection: FC<{
  forwardFlashcard?: Pick<SelectFlashcard, "due"> | undefined;
  reverseFlashcard?: Pick<SelectFlashcard, "due"> | undefined;
  showReverse: boolean;
}> = ({ forwardFlashcard, reverseFlashcard, showReverse }) => {
  const colors = useThemeColors();

  if (showReverse) {
    const forwardNext = forwardFlashcard
      ? formatNextReview({ due: forwardFlashcard.due })
      : null;
    const reverseNext = reverseFlashcard
      ? formatNextReview({ due: reverseFlashcard.due })
      : null;

    return (
      <View className="gap-2">
        <View className="flex-row items-center gap-1.5">
          <Timer color={colors.mutedForeground} size={14} />
          <Text className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            <Trans>Next Review</Trans>
          </Text>
        </View>
        {forwardNext && (
          <View className="flex-row items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
            <Text className="text-muted-foreground text-xs">
              <Trans>Arabic → English</Trans>
            </Text>
            <Text
              className={cn(
                "font-semibold text-xs",
                forwardNext.isOverdue ? "text-red-600" : "text-foreground"
              )}
            >
              {forwardNext.label}
            </Text>
          </View>
        )}
        {reverseNext && (
          <View className="flex-row items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
            <Text className="text-muted-foreground text-xs">
              <Trans>English → Arabic</Trans>
            </Text>
            <Text
              className={cn(
                "font-semibold text-xs",
                reverseNext.isOverdue ? "text-red-600" : "text-foreground"
              )}
            >
              {reverseNext.label}
            </Text>
          </View>
        )}
      </View>
    );
  }

  const next = forwardFlashcard
    ? formatNextReview({ due: forwardFlashcard.due })
    : null;

  if (!next) return null;

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-1.5">
        <Timer color={colors.mutedForeground} size={14} />
        <Text className="text-muted-foreground text-xs">
          <Trans>Next review</Trans>
        </Text>
      </View>
      <Text
        className={cn(
          "font-semibold text-xs",
          next.isOverdue ? "text-red-600" : "text-foreground"
        )}
      >
        {next.label}
      </Text>
    </View>
  );
};

export const ReviewHistory: FC<{ entryId: string }> = ({ entryId }) => {
  const { isProUser } = useUserPlan();
  const colors = useThemeColors();

  const { data: settingsData } = useQuery({
    queryFn: settingsTable.get.query,
    ...settingsTable.get.cacheOptions,
  });
  const showReverse = settingsData?.show_reverse_flashcards ?? false;

  const { data: revlogData } = useQuery({
    queryFn: async () => {
      const { data, error } = await api.stats.revlogs.entry({ entryId }).get();
      if (error) throw error;
      return data;
    },
    queryKey: ["stats.revlogs.entry", entryId],
    enabled: isProUser,
  });

  const { data: flashcardData } = useQuery({
    queryFn: () => flashcardsTable.findByEntryId.query({ entryId }),
    queryKey: [...flashcardsTable.findByEntryId.cacheOptions.queryKey, entryId],
    enabled: isProUser,
  });

  if (!isProUser) {
    return (
      <View className="gap-1.5 border-border/50 border-t pt-3">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Review History</Trans>
          </Text>
          <Lock color={colors.mutedForeground} size={12} />
        </View>
        <Text className="text-muted-foreground text-xs">
          <Trans>
            Upgrade to Pro to see your review history for this word.
          </Trans>
        </Text>
      </View>
    );
  }

  const revlogs = revlogData?.revlogs ?? [];
  const forwardRevlogs = revlogs.filter((r) => r.direction === "forward");
  const reverseRevlogs = revlogs.filter((r) => r.direction === "reverse");
  const forwardFlashcard = flashcardData?.find(
    (f) => f.direction === "forward"
  );
  const reverseFlashcard = flashcardData?.find(
    (f) => f.direction === "reverse"
  );

  const hasRevlogs = revlogs.length > 0;

  return (
    <View className="gap-3 border-border/50 border-t pt-3">
      <Text className="font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
        <Trans>Review History</Trans>
      </Text>

      {hasRevlogs ? (
        showReverse ? (
          <>
            <DirectionTimeline
              flashcard={forwardFlashcard}
              label={t`Arabic → English`}
              revlogs={forwardRevlogs}
            />
            <DirectionTimeline
              flashcard={reverseFlashcard}
              label={t`English → Arabic`}
              revlogs={reverseRevlogs}
            />
            <RatingLegend />
          </>
        ) : (
          <>
            <DirectionTimeline
              flashcard={forwardFlashcard}
              revlogs={forwardRevlogs}
            />
            <RatingLegend />
          </>
        )
      ) : undefined}

      <NextReviewSection
        forwardFlashcard={forwardFlashcard}
        reverseFlashcard={reverseFlashcard}
        showReverse={showReverse}
      />
    </View>
  );
};
