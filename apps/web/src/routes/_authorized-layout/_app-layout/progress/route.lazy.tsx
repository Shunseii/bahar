import { createScheduler, toFsrsCard } from "@bahar/fsrs";
import { Badge } from "@bahar/web-ui/components/badge";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Rating, type ReviewLog } from "ts-fsrs";
import { Page } from "@/components/Page";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { progressTable } from "@/lib/db/operations/progress";
import { settingsTable } from "@/lib/db/operations/settings";
import { queryClient } from "@/lib/query";
import { DifficultWordsCard } from "./-components/DifficultWordsCard";
import { ProPlaceholder } from "./-components/ProPlaceholder";
import {
  type RecentReview,
  RecentReviewsCard,
} from "./-components/RecentReviewsCard";
import { RetentionRateCard } from "./-components/RetentionRateCard";
import { StreakCard } from "./-components/StreakCard";
import { WordsAddedCard } from "./-components/WordsAddedCard";
import { WordsLearnedCard } from "./-components/WordsLearnedCard";
import { WorkloadForecastCard } from "./-components/WorkloadForecastCard";

const Progress = () => {
  const { i18n } = useLingui();
  const { data: userData } = authClient.useSession();
  const isFreeTier =
    !userData?.user.plan ||
    !userData.user.subscriptionStatus ||
    userData.user.subscriptionStatus === "canceled";

  const { data: settingsData } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });

  const showReverse = settingsData?.show_reverse_flashcards ?? false;

  const { data: streakData, isLoading: isStreakLoading } = useQuery({
    queryFn: progressTable.streak.query,
    ...progressTable.streak.cacheOptions,
    staleTime: 5 * 60 * 1000,
  });

  const { data: wordsData, isLoading: isWordsLoading } = useQuery({
    queryFn: progressTable.wordsAdded.query,
    ...progressTable.wordsAdded.cacheOptions,
    staleTime: 5 * 60 * 1000,
  });

  const { data: wordsLearnedData, isLoading: isWordsLearnedLoading } = useQuery(
    {
      queryFn: progressTable.wordsLearned.query,
      ...progressTable.wordsLearned.cacheOptions,
      staleTime: 5 * 60 * 1000,
      enabled: !isFreeTier,
    }
  );

  const { data: difficultData, isLoading: isDifficultLoading } = useQuery({
    queryFn: progressTable.difficultWords.query,
    ...progressTable.difficultWords.cacheOptions,
    staleTime: 5 * 60 * 1000,
    enabled: !isFreeTier,
  });

  const { data: retentionData, isLoading: isRetentionLoading } = useQuery({
    queryFn: async () => {
      const { data, error } = await api.stats.retention.get();
      if (error) throw error;
      return data;
    },
    queryKey: ["stats.retention"],
    staleTime: 5 * 60 * 1000,
    enabled: !isFreeTier,
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
    staleTime: 5 * 60 * 1000,
    enabled: !isFreeTier,
  });

  const { data: recentRevlogs, isLoading: isRecentLoading } = useQuery({
    queryFn: async () => {
      const { data, error } = await api.stats.revlogs.recent.get();
      if (error) throw error;
      return data;
    },
    queryKey: ["stats.revlogs.recent"],
    staleTime: 60 * 1000,
    enabled: !isFreeTier,
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
            ? { ...old, revlogs: old.revlogs.filter((r) => r.id !== review.id) }
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

        const LABEL_TO_RATING: Record<string, Rating> = {
          again: Rating.Again,
          hard: Rating.Hard,
          good: Rating.Good,
          easy: Rating.Easy,
        };

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
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.counts.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: progressTable.streak.cacheOptions.queryKey,
      });
    },
  });

  return (
    <Page className="m-auto flex w-full max-w-3xl flex-col gap-y-6 px-4 pb-8">
      <h1 className="text-center font-primary font-semibold text-3xl">
        <Trans>Progress</Trans>
      </h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StreakCard data={streakData} isLoading={isStreakLoading} />
        <WordsAddedCard data={wordsData} isLoading={isWordsLoading} />
      </div>

      {isFreeTier ? (
        <ProPlaceholder />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">
              <Trans>Insights</Trans>
            </h2>
            <Badge className="text-white uppercase"><Trans>Pro</Trans></Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WordsLearnedCard
              data={wordsLearnedData}
              isLoading={isWordsLearnedLoading}
            />
            <RetentionRateCard
              data={retentionData}
              isLoading={isRetentionLoading}
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <DifficultWordsCard
              data={difficultData}
              isLoading={isDifficultLoading}
            />
            <WorkloadForecastCard
              data={forecastData}
              isLoading={isForecastLoading}
            />
          </div>

          <RecentReviewsCard
            isLoading={isRecentLoading}
            isUndoing={isUndoing}
            onUndo={undoReview}
            reviews={recentReviews}
          />
        </div>
      )}
    </Page>
  );
};

export const Route = createLazyFileRoute(
  "/_authorized-layout/_app-layout/progress"
)({
  component: Progress,
});
