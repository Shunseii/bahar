import { createLazyFileRoute } from "@tanstack/react-router";
import {
  createEmptyCard,
  formatDate,
  fsrs,
  generatorParameters,
  Rating,
  Grades,
  State,
} from "ts-fsrs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfiniteScroll } from "@/components/meili/InfiniteScroll";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import { useWindowScroll, useWindowSize } from "@uidotdev/usehooks";
import { Trans } from "@lingui/macro";
import { cn } from "@/lib/utils";
import { Page } from "@/components/Page";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

const Index = () => {
  const [{ y }, scrollTo] = useWindowScroll();
  const { height } = useWindowSize();
  const { mutate } = trpc.flashcard.update.useMutation();
  const { data } = trpc.flashcard.today.useQuery();

  // Check that the window dimensions are available
  const hasLoadedHeight = height !== null && height > 0 && y !== null;
  const hasScrolledPastInitialView = hasLoadedHeight ? y > height : false;

  useEffect(() => {
    if (!data) return;

    const f = fsrs();
    const cards = data?.flashcards ?? [];
    const now = new Date();
    const scheduling_cards = f.repeat(cards[0], now);

    const ratedCard = scheduling_cards[Rating.Easy].card;
    const card = {
      ...ratedCard,
      id: cards[0].id,
      due: ratedCard.due.toISOString(),
      last_review: ratedCard?.last_review?.toISOString() ?? null,
      due_timestamp: Math.floor(ratedCard.due.getTime() / 1000),
      last_review_timestamp: ratedCard?.last_review
        ? Math.floor(ratedCard.last_review.getTime() / 1000)
        : null,
    };

    // mutate(card);
  }, [data]);

  return (
    <Page>
      <Card className="m-auto w-full max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle>
            <Trans>Dictionary</Trans>
          </CardTitle>

          <CardDescription>
            <Trans>View all the words in your personal dictionary.</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <InfiniteScroll />
        </CardContent>
      </Card>

      {/* Scroll to top button */}
      <div
        className={cn(
          "fixed bottom-8 ltr:right-8 rtl:left-8 transition-opacity opacity-0 pointer-events-none cursor-auto",
          hasScrolledPastInitialView &&
            "opacity-100 pointer-events-auto cursor-pointer",
        )}
      >
        <Button
          onClick={() => {
            scrollTo({ top: 0, behavior: "smooth" });
          }}
          tabIndex={hasScrolledPastInitialView ? 0 : -1}
          variant="secondary"
        >
          <ArrowUp className="w-5 h-5" />

          <span className="sr-only">
            <Trans>Back to top</Trans>
          </span>
        </Button>
      </div>
    </Page>
  );
};

export const Route = createLazyFileRoute("/_search-layout/")({
  component: Index,
});
