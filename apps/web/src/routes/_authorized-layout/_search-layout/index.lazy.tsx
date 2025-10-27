import { Plural, Trans } from "@lingui/react/macro";
import { Link, createLazyFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfiniteScroll } from "@/components/search/InfiniteScroll";
import { Button } from "@/components/ui/button";
import { ArrowUp, PlusIcon } from "lucide-react";
import { useWindowScroll, useWindowSize } from "@uidotdev/usehooks";
import { cn } from "@bahar/design-system";
import { Page } from "@/components/Page";
import { FlashcardDrawer } from "@/components/features/flashcards/FlashcardDrawer";
import { flashcardsTable, settingsTable } from "@/lib/db/operations";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@/hooks/useSearch";

const Index = () => {
  const [{ y }, scrollTo] = useWindowScroll();
  const { results } = useSearch();
  const { height } = useWindowSize();
  const { data: flashcardSettings } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });

  const show_reverse = flashcardSettings?.show_reverse_flashcards ?? false;

  const { data, isFetching } = useQuery({
    queryFn: async ({ queryKey: [, showReverse] }) =>
      flashcardsTable.today.query({
        showReverse: showReverse as boolean,
      }),
    ...flashcardsTable.today.cacheOptions,
    queryKey: [...flashcardsTable.today.cacheOptions.queryKey, show_reverse],
  });

  // Check that the window dimensions are available
  const hasLoadedHeight = height !== null && height > 0 && y !== null;
  const hasScrolledPastInitialView = hasLoadedHeight ? y > height : false;

  const processingTimeLabel = results?.elapsed?.formatted;
  const totalHits = results?.count;

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

          <FlashcardDrawer show_reverse={show_reverse}>
            <Button
              className="w-max self-end relative"
              variant="outline"
              disabled={isFetching}
            >
              {/* Notification */}
              {data?.length ? (
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
          {processingTimeLabel !== undefined && totalHits ? (
            <p className="text-center text-sm text-muted-foreground">
              <Plural
                value={totalHits}
                one="# result found in"
                other="# results found in"
              />{" "}
              {processingTimeLabel}
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

export const Route = createLazyFileRoute("/_authorized-layout/_search-layout/")(
  {
    component: Index,
  },
);
