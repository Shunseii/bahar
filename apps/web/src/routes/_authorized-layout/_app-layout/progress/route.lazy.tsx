import { cn } from "@bahar/design-system";
import { Badge } from "@bahar/web-ui/components/badge";
import { Button } from "@bahar/web-ui/components/button";
import { Card, CardContent } from "@bahar/web-ui/components/card";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Page } from "@/components/Page";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { progressTable } from "@/lib/db/operations/progress";
import { settingsTable } from "@/lib/db/operations/settings";
import { DifficultWordsCard } from "./-components/DifficultWordsCard";
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
            <Badge className="text-white uppercase">Pro</Badge>
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
        </div>
      )}
    </Page>
  );
};

function ProPlaceholder() {
  return (
    <div className="relative">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg">
            <Trans>Insights</Trans>
          </h2>
          <Badge className="text-white uppercase">Pro</Badge>
        </div>

        {/* Blurred placeholder content */}
        <div className="pointer-events-none select-none blur-sm">
          {/* Fake heatmap */}
          <div className="rounded-xl border bg-background p-5">
            <p className="mb-3 font-medium text-sm">
              <Trans>Review Activity</Trans>
            </p>
            <div className="flex gap-0.5">
              {Array.from({ length: 52 }).map((_, i) => (
                <div className="flex flex-col gap-0.5" key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div
                      className={cn(
                        "h-2.5 w-2.5 rounded-sm",
                        Math.random() > 0.6
                          ? "bg-indigo-400"
                          : Math.random() > 0.5
                            ? "bg-indigo-200"
                            : "bg-muted"
                      )}
                      key={j}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Fake insight cards */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-background p-5">
              <p className="text-muted-foreground text-sm">
                <Trans>Words Learned</Trans>
              </p>
              <span className="font-bold text-3xl">62</span>
            </div>
            <div className="rounded-xl border bg-background p-5">
              <p className="text-muted-foreground text-sm">
                <Trans>Retention Rate</Trans>
              </p>
              <span className="font-bold text-3xl">87%</span>
            </div>
            <div className="rounded-xl border bg-background p-5">
              <p className="text-muted-foreground text-sm">
                <Trans>Difficult Words</Trans>
              </p>
              <span className="font-bold text-3xl">12</span>
            </div>
            <div className="rounded-xl border bg-background p-5">
              <p className="text-muted-foreground text-sm">
                <Trans>Workload Forecast</Trans>
              </p>
              <span className="font-bold text-3xl">~28</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay card */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Card className="max-w-sm shadow-lg">
          <CardContent className="flex flex-col items-center py-6">
            <Lock className="mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="font-semibold text-lg">
              <Trans>Unlock Insights</Trans>
            </h3>
            <p className="mt-1 text-center text-muted-foreground text-sm">
              <Trans>
                See your retention rate, workload forecast, difficult words, and
                more.
              </Trans>
            </p>
            <Button
              className="mt-4"
              onClick={async () => {
                await authClient.checkout({ slug: "pro" });
              }}
            >
              <Trans>Upgrade to Pro</Trans>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute(
  "/_authorized-layout/_app-layout/progress"
)({
  component: Progress,
});
