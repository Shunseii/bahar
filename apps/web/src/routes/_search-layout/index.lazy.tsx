import { Link, createLazyFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfiniteScroll } from "@/components/meili/InfiniteScroll";
import { Button } from "@/components/ui/button";
import { ArrowUp, PlusIcon } from "lucide-react";
import { useWindowScroll, useWindowSize } from "@uidotdev/usehooks";
import { Plural, Trans } from "@lingui/macro";
import { cn } from "@/lib/utils";
import { Page } from "@/components/Page";
import { trpc } from "@/lib/trpc";
import { FlashcardDrawer } from "@/components/FlashcardDrawer";
import { useInstantSearch } from "react-instantsearch";

const Index = () => {
  const [{ y }, scrollTo] = useWindowScroll();
  const { results } = useInstantSearch();
  const { height } = useWindowSize();
  const { data, isFetching } = trpc.flashcard.today.useQuery();

  // Check that the window dimensions are available
  const hasLoadedHeight = height !== null && height > 0 && y !== null;
  const hasScrolledPastInitialView = hasLoadedHeight ? y > height : false;

  const processingTimeMs = results?.processingTimeMS;
  const totalHits = results?.nbHits;

  return (
    <Page>
      <div className="m-auto max-w-3xl flex flex-col gap-y-4">
        <div className="flex flex-row justify-between">
          <Button variant="outline" asChild>
            <Link to="/dictionary/add">
              <PlusIcon className="w-5 h-5 ltr:mr-2 rtl:ml-2" />
              <Trans>Add word</Trans>
            </Link>
          </Button>

          <FlashcardDrawer>
            <Button
              className="w-max self-end relative"
              variant="outline"
              disabled={isFetching}
            >
              {/* Notification */}
              {data?.flashcards?.length ? (
                <div className="motion-safe:animate-pulse absolute border-background border-2 -top-1 ltr:-right-1 rtl:-left-1 p-1 text-xs h-2.5 w-2.5 bg-red-500 rounded-full" />
              ) : undefined}

              <p
                className={cn(
                  isFetching &&
                    "motion-safe:animate-pulse motion-reduce:opacity-50",
                )}
              >
                <Trans>Review flashcards</Trans>
              </p>
            </Button>
          </FlashcardDrawer>
        </div>

        <div>
          {processingTimeMs !== undefined && totalHits ? (
            <p className="text-center text-sm text-muted-foreground">
              <Plural
                value={totalHits}
                one="# result found in"
                other="# results found in"
              />{" "}
              <Plural value={processingTimeMs} _0="<1 ms" other="# ms" />
            </p>
          ) : undefined}
        </div>

        <Card>
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
      </div>

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
