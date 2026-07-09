import { createScheduler, toFsrsCard } from "@bahar/fsrs";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react-native";
import { useCallback } from "react";
import { RefreshControl, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Rating, type ReviewLog } from "ts-fsrs";
import { DifficultWordsCard } from "@/components/progress/DifficultWordsCard";
import { ProPlaceholder } from "@/components/progress/ProPlaceholder";
import {
  type RecentReview,
  RecentReviewsCard,
} from "@/components/progress/RecentReviewsCard";
import { StatCard } from "@/components/progress/StatCard";
import { StreakCard } from "@/components/progress/StreakCard";
import { WorkloadForecastCard } from "@/components/progress/WorkloadForecastCard";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useCollapsibleHeader } from "@/hooks/useCollapsibleHeader";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { useUserPlan } from "@/hooks/useUserPlan";
import {
  flashcardsTable,
  progressTable,
  settingsTable,
} from "@/lib/db/operations";
import { useThemeColors } from "@/lib/theme";
import { api, queryClient } from "@/utils/api";

const STALE_TIME = 5 * 60 * 1000;

export default function StatsScreen() {
  const { i18n } = useLingui();
  const colors = useThemeColors();
  const { scrollHandler } = useCollapsibleHeader(t`Progress`);
  const { isFreeUser } = useUserPlan();
  const { formatNumber } = useFormatNumber();

  const { data: settingsData } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });

  const showReverse = settingsData?.show_reverse_flashcards ?? false;

  // -- Free tier queries --
  const { data: streakData, isLoading: isStreakLoading } = useQuery({
    queryFn: progressTable.streak.query,
    ...progressTable.streak.cacheOptions,
    staleTime: STALE_TIME,
  });

  const { data: wordsData, isLoading: isWordsLoading } = useQuery({
    queryFn: progressTable.wordsAdded.query,
    ...progressTable.wordsAdded.cacheOptions,
    staleTime: STALE_TIME,
  });

  // -- Pro tier queries --
  const { data: wordsLearnedData, isLoading: isWordsLearnedLoading } = useQuery(
    {
      queryFn: progressTable.wordsLearned.query,
      ...progressTable.wordsLearned.cacheOptions,
      staleTime: STALE_TIME,
      enabled: !isFreeUser,
    }
  );

  const { data: retentionData, isLoading: isRetentionLoading } = useQuery({
    queryFn: async () => {
      const { data, error } = await api.stats.retention.get();
      if (error) throw error;
      return data;
    },
    queryKey: ["stats.retention"],
    staleTime: STALE_TIME,
    enabled: !isFreeUser,
  });

  const { data: forecastData, isLoading: isForecastLoading } = useQuery({
    queryFn: () =>
      progressTable.workloadForecast.query({
        showReverse,
        locale: i18n.locale,
      }),
    queryKey: [
      ...progressTable.workloadForecast.cacheOptions.queryKey,
      showReverse,
      i18n.locale,
    ],
    staleTime: STALE_TIME,
    enabled: !isFreeUser,
  });

  const { data: difficultData, isLoading: isDifficultLoading } = useQuery({
    queryFn: progressTable.difficultWords.query,
    ...progressTable.difficultWords.cacheOptions,
    staleTime: STALE_TIME,
    enabled: !isFreeUser,
  });

  const { data: recentRevlogs, isLoading: isRecentLoading } = useQuery({
    queryFn: async () => {
      const { data, error } = await api.stats.revlogs.recent.get();
      if (error) throw error;
      return data;
    },
    queryKey: ["stats.revlogs.recent"],
    staleTime: 60 * 1000,
    enabled: !isFreeUser,
  });

  const entryIds = [
    ...new Set(recentRevlogs?.revlogs.map((r) => r.dictionary_entry_id) ?? []),
  ];

  const { data: wordMap } = useQuery({
    queryFn: () => progressTable.recentReviewWords.query(entryIds),
    queryKey: [
      ...progressTable.recentReviewWords.cacheOptions.queryKey,
      entryIds,
    ],
    enabled: entryIds.length > 0,
    placeholderData: (prev) => prev,
  });

  const recentReviews =
    recentRevlogs?.revlogs.reduce<RecentReview[]>((acc, r) => {
      if (!r.rating || r.rating === "manual") return acc;
      const entry = wordMap?.get(r.dictionary_entry_id);
      if (!entry) return acc;
      acc.push({
        id: r.id,
        dictionaryEntryId: r.dictionary_entry_id,
        direction: r.direction,
        word: entry.word,
        translation: entry.translation,
        rating: r.rating,
        reviewTimestampMs: r.review_timestamp_ms,
      });
      return acc;
    }, []) ?? [];

  // -- Undo review mutation --
  const LABEL_TO_RATING: Record<string, Rating> = {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
    easy: Rating.Easy,
  };

  const { mutate: undoReview, isPending: isUndoing } = useMutation({
    onMutate: async (review: RecentReview) => {
      await queryClient.cancelQueries({ queryKey: ["stats.revlogs.recent"] });
      const previous = queryClient.getQueryData<typeof recentRevlogs>([
        "stats.revlogs.recent",
      ]);
      queryClient.setQueryData<typeof recentRevlogs>(
        ["stats.revlogs.recent"],
        (old) =>
          old
            ? {
                ...old,
                revlogs: old.revlogs.filter((r) => r.id !== review.id),
              }
            : old
      );
      return { previous };
    },
    onError: (_err, _review, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["stats.revlogs.recent"], context.previous);
      }
    },
    mutationFn: async (review: RecentReview) => {
      const { data, error } = await api.stats
        .revlogs({ id: review.id })
        .delete();
      if (error) throw error;

      const { data: flashcard } =
        await flashcardsTable.findByEntryAndDirection.query({
          dictionaryEntryId: review.dictionaryEntryId,
          direction: review.direction,
        });

      if (flashcard) {
        const f = createScheduler();
        const currentCard = toFsrsCard(flashcard);
        const revlog = data.revlog;

        const reviewLog = {
          rating: LABEL_TO_RATING[revlog.rating ?? ""] ?? Rating.Good,
          state: revlog.state ?? 0,
          due: new Date(revlog.due),
          stability: revlog.stability ?? 0,
          difficulty: revlog.difficulty ?? 0,
          scheduled_days: revlog.scheduled_days ?? 0,
          learning_steps: revlog.learning_steps ?? 0,
          review: new Date(revlog.review),
          elapsed_days: 0,
          last_elapsed_days: 0,
        } satisfies ReviewLog;

        const prevCard = f.rollback(currentCard, reviewLog);

        await flashcardsTable.update.mutation({
          id: flashcard.id,
          updates: {
            due: prevCard.due.toISOString(),
            due_timestamp_ms: prevCard.due.getTime(),
            last_review: prevCard.last_review?.toISOString() ?? null,
            last_review_timestamp_ms: prevCard.last_review?.getTime() ?? null,
            state: prevCard.state,
            stability: prevCard.stability,
            difficulty: prevCard.difficulty,
            reps: prevCard.reps,
            lapses: prevCard.lapses,
            elapsed_days: prevCard.elapsed_days,
            scheduled_days: prevCard.scheduled_days,
            learning_steps: prevCard.learning_steps,
          },
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["stats.revlogs.recent"] });
      queryClient.invalidateQueries({ queryKey: ["stats.retention"] });
      queryClient.invalidateQueries({ queryKey: ["turso.progress"] });
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.counts.cacheOptions.queryKey,
      });
    },
  });

  // -- Computed stat values --
  const wordsLearnedPct =
    wordsLearnedData && wordsLearnedData.totalAdded > 0
      ? Math.round(
          (wordsLearnedData.learned / wordsLearnedData.totalAdded) * 100
        )
      : 0;

  const retentionPct =
    retentionData?.rate != null
      ? `${formatNumber(Math.round(retentionData.rate * 100))}%`
      : "—";

  const retentionTrend = (() => {
    const trend = retentionData?.trend;
    if (trend == null) return null;
    const pct = Number((trend * 100).toFixed(1));
    if (pct === 0) return null;
    return {
      text: `${pct > 0 ? "+" : ""}${formatNumber(pct)}% ${t`vs last week`}`,
      positive: pct > 0,
    };
  })();

  // -- Pull to refresh --
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["turso.progress"] }),
      queryClient.invalidateQueries({ queryKey: ["stats.retention"] }),
      queryClient.invalidateQueries({ queryKey: ["stats.revlogs.recent"] }),
    ]);
  }, []);

  const isRefreshing =
    isStreakLoading || isWordsLoading || isWordsLearnedLoading;

  return (
    <Animated.ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pb-safe-offset-6"
      onScroll={scrollHandler}
      refreshControl={
        <RefreshControl onRefresh={handleRefresh} refreshing={isRefreshing} />
      }
      scrollEventThrottle={16}
    >
      <ScreenHeader icon={Activity} title={t`Progress`} />

      <View className="gap-4 px-4 pt-4">
        {/* Always visible: Streak + Words Added */}
        <StreakCard data={streakData} isLoading={isStreakLoading} />

        <StatCard
          isLoading={isWordsLoading}
          label={t`Words Added`}
          trend={
            wordsData?.thisWeek
              ? {
                  text: `+${formatNumber(wordsData.thisWeek)} ${t`this week`}`,
                  positive: true,
                }
              : null
          }
          value={formatNumber(wordsData?.total ?? 0)}
        />

        {/* Pro-gated insights section */}
        {isFreeUser ? (
          <ProPlaceholder />
        ) : (
          <>
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold text-foreground text-lg">
                <Trans>Insights</Trans>
              </Text>
              <View className="rounded-full bg-primary px-2 py-0.5">
                <Text className="font-semibold text-white text-xs uppercase">
                  <Trans>Pro</Trans>
                </Text>
              </View>
            </View>

            <StatCard
              detail={`${formatNumber(wordsLearnedData?.learned ?? 0)} ${t`words`}`}
              isLoading={isWordsLearnedLoading}
              label={t`Words Learned`}
              tooltip={
                <Trans>
                  Words that have graduated from the learning phase into review.
                </Trans>
              }
              trend={
                wordsLearnedData?.thisWeek
                  ? {
                      text: `+${formatNumber(wordsLearnedData.thisWeek)} ${t`this week`}`,
                      positive: true,
                    }
                  : null
              }
              value={`${formatNumber(wordsLearnedPct)}%`}
            />
            <StatCard
              detail={t`7-day average`}
              isLoading={isRetentionLoading}
              label={t`Retention Rate`}
              tooltip={
                <Trans>
                  Percentage of mature card reviews not rated "Again" over the
                  last 7 days.
                </Trans>
              }
              trend={retentionTrend}
              value={retentionPct}
            />

            <WorkloadForecastCard
              data={forecastData}
              isLoading={isForecastLoading}
            />

            <DifficultWordsCard
              data={difficultData}
              isLoading={isDifficultLoading}
            />

            <RecentReviewsCard
              isLoading={isRecentLoading}
              isUndoing={isUndoing}
              onUndo={undoReview}
              reviews={recentReviews}
            />
          </>
        )}
      </View>
    </Animated.ScrollView>
  );
}
