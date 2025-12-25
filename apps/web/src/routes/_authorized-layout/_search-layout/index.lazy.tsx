import { Plural, Trans } from "@lingui/react/macro";
import { Link, createLazyFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { InfiniteScroll } from "@/components/search/InfiniteScroll";
import { Button } from "@/components/ui/button";
import { ArrowUp, PlusIcon, GraduationCap, BookOpen } from "lucide-react";
import { useWindowScroll, useWindowSize } from "@uidotdev/usehooks";
import { cn } from "@bahar/design-system";
import { Page, itemVariants } from "@/components/Page";
import { FlashcardDrawer } from "@/components/features/flashcards/FlashcardDrawer/FlashcardDrawer";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  flashcardsTable,
} from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@/hooks/useSearch";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { motion } from "motion/react";

const Index = () => {
  const { formatNumber, formatElapsedTime } = useFormatNumber();
  const [{ y }, scrollTo] = useWindowScroll();
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
      <div className="m-auto max-w-3xl flex flex-col gap-y-5">
        {/* Dictionary Card */}
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden border-0 shadow-2xl shadow-black/10 dark:shadow-black/30">
            {/* Decorative gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.02]" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {/* Header */}
            <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold tracking-tight">
                      <Trans>Your Dictionary</Trans>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {totalHits !== undefined ? (
                        <>
                          <span className="font-medium text-foreground/80 tabular-nums">
                            {formatNumber(totalHits)}
                          </span>{" "}
                          <Plural
                            value={totalHits}
                            one="result"
                            other="results"
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
                    size="sm"
                    variant="outline"
                    className="h-9 px-3"
                  >
                    <Link to="/dictionary/add">
                      <PlusIcon className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />
                      <span className="text-sm">
                        <Trans>Add word</Trans>
                      </span>
                    </Link>
                  </Button>

                  <FlashcardDrawer
                    show_reverse={show_reverse}
                    queueCounts={counts}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      className={cn(
                        "relative h-9 px-3 text-muted-foreground hover:text-foreground hover:bg-primary/5",
                        regularCount > 0 && "text-foreground",
                      )}
                    >
                      <GraduationCap className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />
                      <span
                        className={cn(
                          "text-sm",
                          isPending &&
                            "motion-safe:animate-pulse motion-reduce:opacity-50",
                        )}
                      >
                        <Trans>Review</Trans>
                      </span>
                      {!isPending && regularCount > 0 && (
                        <span className="ltr:ml-1.5 rtl:mr-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground shadow-sm">
                          {formatNumber(regularCount)}
                        </span>
                      )}
                      {!isPending && backlogCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm animate-pulse" />
                      )}
                    </Button>
                  </FlashcardDrawer>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-4 sm:mx-6 h-px bg-gradient-to-r from-border/50 via-border to-border/50" />

            {/* Content */}
            <CardContent className="relative pt-4 pb-6 px-4 sm:px-6">
              <InfiniteScroll />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Scroll to top button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: hasScrolledPastInitialView ? 1 : 0,
          scale: hasScrolledPastInitialView ? 1 : 0.8,
        }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed bottom-8 ltr:right-8 rtl:left-8",
          !hasScrolledPastInitialView && "pointer-events-none",
        )}
      >
        <Button
          onClick={() => scrollTo({ top: 0, behavior: "smooth" })}
          tabIndex={hasScrolledPastInitialView ? 0 : -1}
          size="icon"
          className="rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 bg-primary hover:bg-primary/90 transition-all duration-300"
        >
          <ArrowUp className="w-5 h-5" />
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
  },
);
