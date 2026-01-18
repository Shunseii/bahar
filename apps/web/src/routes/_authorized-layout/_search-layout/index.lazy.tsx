import { cn } from "@bahar/design-system";
import { Button } from "@bahar/web-ui/components/button";
import { Card } from "@bahar/web-ui/components/card";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useWindowScroll, useWindowSize } from "@uidotdev/usehooks";
import { useAtomValue } from "jotai";
import { ArrowUp, BookOpen, GraduationCap, PlusIcon } from "lucide-react";
import { motion } from "motion/react";
import { useDeferredValue } from "react";
import { DictionaryFilters } from "@/components/features/dictionary/filters/DictionaryFilters";
import { FlashcardDrawer } from "@/components/features/flashcards/FlashcardDrawer/FlashcardDrawer";
import { itemVariants, Page } from "@/components/Page";
import { InfiniteScroll } from "@/components/search/InfiniteScroll";
import { searchQueryAtom } from "@/components/search/state";
import { useSearch } from "@/hooks/search/useSearch";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  flashcardsTable,
} from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";

const Index = () => {
  const { formatNumber, formatElapsedTime } = useFormatNumber();
  const [{ y }, scrollTo] = useWindowScroll();
  const searchQuery = useAtomValue(searchQueryAtom);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const { results } = useSearch();
  const { height } = useWindowSize();
  const { data: flashcardSettings } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });

  const show_reverse = flashcardSettings?.show_reverse_flashcards ?? false;

  const { data: counts, isPending } = useQuery({
    queryFn: async ({ queryKey: [, showReverse] }) =>
      flashcardsTable.counts.query({
        showReverse: showReverse as boolean,
        backlogThresholdDays: DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }),
    ...flashcardsTable.counts.cacheOptions,
    queryKey: [...flashcardsTable.counts.cacheOptions.queryKey, show_reverse],
  });

  // Check that the window dimensions are available
  const hasLoadedHeight = height !== null && height > 0 && y !== null;
  const hasScrolledPastInitialView = hasLoadedHeight ? y > height : false;

  const processingTimeLabel = results?.elapsed?.raw
    ? formatElapsedTime(results.elapsed.raw)
    : undefined;
  const totalHits = results?.count;
  const regularCount = counts?.regular ?? 0;
  const backlogCount = counts?.backlog ?? 0;

  return (
    <Page>
      <div className="m-auto mb-4 max-w-3xl">
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden">
            <div className="relative px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="font-semibold text-lg tracking-tight">
                      <Trans>Your Dictionary</Trans>
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      {totalHits !== undefined ? (
                        <>
                          <span className="font-medium text-foreground/80 tabular-nums">
                            {formatNumber(totalHits)}
                          </span>{" "}
                          <Plural
                            one="result"
                            other="results"
                            value={totalHits}
                          />
                          {processingTimeLabel && (
                            <span className="text-muted-foreground/60">
                              {" · "}
                              {processingTimeLabel}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="motion-safe:animate-pulse">
                          <Trans>Loading...</Trans>
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    asChild
                    className="h-9 px-3"
                    size="sm"
                    variant="outline"
                  >
                    <Link to="/dictionary/add">
                      <PlusIcon className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                      <span className="text-sm">
                        <Trans>Add word</Trans>
                      </span>
                    </Link>
                  </Button>

                  <FlashcardDrawer
                    queueCounts={counts}
                    show_reverse={show_reverse}
                  >
                    <Button
                      className={cn(
                        "relative h-9 px-3 text-muted-foreground",
                        regularCount > 0 && "text-foreground"
                      )}
                      disabled={isPending}
                      size="sm"
                      variant="outline"
                    >
                      <GraduationCap className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                      <span
                        className={cn(
                          "text-sm",
                          isPending &&
                            "motion-safe:animate-pulse motion-reduce:opacity-50"
                        )}
                      >
                        <Trans>Review</Trans>
                      </span>
                      {!isPending && regularCount > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-semibold text-primary-foreground text-xs shadow-sm ltr:ml-1.5 rtl:mr-1.5">
                          {formatNumber(regularCount)}
                        </span>
                      )}
                      {!isPending && backlogCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500 shadow-sm" />
                      )}
                    </Button>
                  </FlashcardDrawer>
                </div>
              </div>
            </div>

            {/* Divider */}
            {/*<div className="mx-4 h-px bg-linear-to-r from-border/50 via-border to-border/50 sm:mx-6" />*/}

            <div className="px-4 pt-4 pb-4 sm:px-6">
              <DictionaryFilters />
            </div>
          </Card>
        </motion.div>
      </div>

      <InfiniteScroll searchQuery={deferredSearchQuery} />

      {/* Scroll to top button */}
      <motion.div
        animate={{
          opacity: hasScrolledPastInitialView ? 1 : 0,
          scale: hasScrolledPastInitialView ? 1 : 0.8,
        }}
        className={cn(
          "fixed bottom-8 ltr:right-8 rtl:left-8",
          !hasScrolledPastInitialView && "pointer-events-none"
        )}
        initial={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          className="rounded-full bg-primary shadow-lg shadow-primary/20 transition-all duration-300 hover:bg-primary/90 hover:shadow-primary/30 hover:shadow-xl"
          onClick={() => scrollTo({ top: 0, behavior: "smooth" })}
          size="icon"
          tabIndex={hasScrolledPastInitialView ? 0 : -1}
        >
          <ArrowUp className="h-5 w-5" />
          <span className="sr-only">
            <Trans>Back to top</Trans>
          </span>
        </Button>
      </motion.div>
    </Page>
  );
};

export const Route = createLazyFileRoute("/_authorized-layout/_search-layout/")(
  {
    component: Index,
  }
);
