import { Badge } from "@bahar/web-ui/components/badge";
import { Button } from "@bahar/web-ui/components/button";
import { Card, CardContent } from "@bahar/web-ui/components/card";
import { Trans } from "@lingui/react/macro";
import { Lock } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { DifficultWordsCard } from "./DifficultWordsCard";
import { RetentionRateCard } from "./RetentionRateCard";
import { WordsLearnedCard } from "./WordsLearnedCard";
import { WorkloadForecastCard } from "./WorkloadForecastCard";

const FAKE_WORDS_LEARNED = { learned: 62, totalAdded: 140, thisWeek: 8 };
const FAKE_RETENTION = { rate: 0.87, trend: 0.03, reviewCount: 45 };
const FAKE_DIFFICULT = {
  total: 12,
  words: [
    {
      word: "اِسْتِغْفَار",
      translation: "seeking forgiveness",
      entryId: "",
      bothDirections: false,
    },
    {
      word: "مُسْتَشْفَى",
      translation: "hospital",
      entryId: "",
      bothDirections: true,
    },
    {
      word: "اِقْتِصَاد",
      translation: "economy",
      entryId: "",
      bothDirections: false,
    },
  ],
};
const FAKE_FORECAST = {
  days: [
    { label: "Mon", count: 12 },
    { label: "Tue", count: 8 },
    { label: "Wed", count: 15 },
    { label: "Thu", count: 6 },
    { label: "Fri", count: 20 },
    { label: "Sat", count: 10 },
    { label: "Sun", count: 14 },
  ],
  tomorrowCount: 12,
};

export function ProPlaceholder() {
  return (
    <div className="relative">
      <div className="flex flex-col gap-4 blur-sm">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg">
            <Trans>Insights</Trans>
          </h2>
          <Badge className="text-white uppercase">
            <Trans>Pro</Trans>
          </Badge>
        </div>

        <div className="pointer-events-none select-none">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WordsLearnedCard data={FAKE_WORDS_LEARNED} isLoading={false} />
            <RetentionRateCard data={FAKE_RETENTION} isLoading={false} />
          </div>
          <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <DifficultWordsCard data={FAKE_DIFFICULT} isLoading={false} />
            <WorkloadForecastCard data={FAKE_FORECAST} isLoading={false} />
          </div>
        </div>
      </div>

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
