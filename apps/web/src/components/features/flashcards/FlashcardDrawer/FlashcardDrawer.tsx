import { cn } from "@bahar/design-system";
import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import { toFsrsCard } from "@bahar/fsrs";
import { Button } from "@bahar/web-ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@bahar/web-ui/components/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { Plural, Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, Brain, PartyPopper, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type FC,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fsrs, type Grade, Rating } from "ts-fsrs";
import { useDir } from "@/hooks/useDir";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { decksTable } from "@/lib/db/operations/decks";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  type FlashcardQueue,
  type FlashcardWithDictionaryEntry,
  flashcardsTable,
} from "@/lib/db/operations/flashcards";
import { queryClient } from "@/lib/query";
import { AnswerSide } from "../AnswerSide";
import { QuestionSide } from "../QuestionSide";
import { ReverseAnswerSide } from "../ReverseAnswerSide";
import { ReverseQuestionSide } from "../ReverseQuestionSide";
import { GradeFeedback } from "./GradeFeedback";
import { GradeOption } from "./GradeOption";
import { TagBadgesList } from "./TagBadgesList";
import { formatScheduleOptions } from "./utils";

interface FlashcardDrawerProps extends PropsWithChildren {
  filters?: SelectDeck["filters"];
  show_reverse?: boolean;
  initialQueue?: FlashcardQueue;
  /** If provided, shows queue counts and allows switching between queues */
  queueCounts?: { regular: number; backlog: number };
}

export const FlashcardDrawer: FC<FlashcardDrawerProps> = ({
  children,
  filters = {},
  show_reverse = false,
  initialQueue = "regular",
  queueCounts,
}) => {
  const { formatNumber } = useFormatNumber();
  const [showAnswer, setShowAnswer] = useState(false);
  const [pendingGrade, setPendingGrade] = useState<Grade | null>(null);
  const [selectedQueue, setSelectedQueue] =
    useState<FlashcardQueue>(initialQueue);
  const gradeCallbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setShowAnswer(false);
  }, [selectedQueue]);

  const { data: fetchedCounts } = useQuery({
    queryFn: () =>
      flashcardsTable.counts.query({
        filters,
        showReverse: show_reverse,
        backlogThresholdDays: DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }),
    ...flashcardsTable.counts.cacheOptions,
    queryKey: [
      ...flashcardsTable.counts.cacheOptions.queryKey,
      show_reverse,
      filters,
    ],
    enabled: !queueCounts,
  });

  const counts = queueCounts ?? fetchedCounts ?? { regular: 0, backlog: 0 };

  const { data } = useQuery({
    queryFn: () =>
      flashcardsTable.today.query({
        filters,
        showReverse: show_reverse,
        queue: selectedQueue,
        backlogThresholdDays: DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }),
    ...flashcardsTable.today.cacheOptions,
    queryKey: [
      ...flashcardsTable.today.cacheOptions.queryKey,
      show_reverse,
      filters,
      selectedQueue,
    ],
  });

  const { mutateAsync: updateFlashcard } = useMutation({
    mutationFn: flashcardsTable.update.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.counts.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
    },
  });

  const [cards, setCards] = useState<FlashcardWithDictionaryEntry[]>([]);

  useEffect(() => {
    if (data) {
      setCards(data);
    }
  }, [data]);

  const currentCard = cards[0] ?? null;

  const f = useMemo(() => fsrs({ enable_fuzz: true }), []);

  const schedulingData = useMemo(() => {
    if (!currentCard) return null;
    const now = new Date();
    const schedulingCards = f.repeat(toFsrsCard(currentCard), now);
    return { schedulingCards, now };
  }, [currentCard, f]);

  const schedulingCards = schedulingData?.schedulingCards;
  const now = schedulingData?.now ?? new Date();

  const dir = useDir();
  const locale = dir === "rtl" ? "ar-u-nu-arab" : "en";

  const intervalLabels = useMemo(() => {
    if (!schedulingCards) return null;

    return formatScheduleOptions({
      dates: {
        [Rating.Again]: schedulingCards[Rating.Again].card.due,
        [Rating.Hard]: schedulingCards[Rating.Hard].card.due,
        [Rating.Good]: schedulingCards[Rating.Good].card.due,
        [Rating.Easy]: schedulingCards[Rating.Easy].card.due,
      },
      now,
      locale,
    });
  }, [schedulingCards, now, locale]);

  const executeGrade = useCallback(
    async (grade: Grade) => {
      if (!(schedulingCards && currentCard)) return;

      const selectedCard = schedulingCards[grade].card;
      const dueTimestampMs = selectedCard.due.getTime();
      const lastReviewTimestampMs = selectedCard?.last_review
        ? selectedCard.last_review.getTime()
        : null;

      const localUpdates = {
        due: selectedCard.due.toISOString(),
        due_timestamp_ms: dueTimestampMs,
        last_review: selectedCard?.last_review?.toISOString() ?? null,
        last_review_timestamp_ms: lastReviewTimestampMs,
        state: selectedCard.state,
        stability: selectedCard.stability,
        difficulty: selectedCard.difficulty,
        reps: selectedCard.reps,
        lapses: selectedCard.lapses,
        elapsed_days: selectedCard.elapsed_days,
        scheduled_days: selectedCard.scheduled_days,
      };

      setShowAnswer(false);
      setCards((prev) => prev.filter((c) => c.id !== currentCard.id));

      await updateFlashcard({
        id: currentCard.id,
        updates: localUpdates,
      });
    },
    [currentCard, schedulingCards, updateFlashcard]
  );

  const gradeCard = useCallback(
    (grade: Grade) => {
      if (!(schedulingCards && currentCard)) return;

      // Store the callback to execute after animation
      gradeCallbackRef.current = () => executeGrade(grade);

      // Show feedback animation
      setPendingGrade(grade);
    },
    [currentCard, schedulingCards, executeGrade]
  );

  const handleAnimationComplete = useCallback(() => {
    // Execute the stored grade callback
    if (gradeCallbackRef.current) {
      gradeCallbackRef.current();
      gradeCallbackRef.current = null;
    }
    setPendingGrade(null);
  }, []);

  return (
    <Drawer onClose={() => setShowAnswer(false)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DrawerTrigger asChild>{children}</DrawerTrigger>
        </TooltipTrigger>

        <TooltipContent>
          {counts.backlog > 0 ? (
            <Trans>
              Review flashcards ({formatNumber(counts.backlog)} in backlog)
            </Trans>
          ) : (
            <Trans>Review flashcards with spaced repetition</Trans>
          )}
        </TooltipContent>
      </Tooltip>

      <DrawerContent className="overflow-hidden">
        <AnimatePresence>
          {pendingGrade !== null && (
            <GradeFeedback
              grade={pendingGrade}
              onComplete={handleAnimationComplete}
            />
          )}
        </AnimatePresence>

        <DrawerHeader className="border-border/30 border-b pb-4">
          {/* Queue selector */}
          {(counts.regular > 0 || counts.backlog > 0) && (
            <>
              <div className="mb-4 flex items-center justify-center gap-2">
                <div className="inline-flex gap-1 rounded-lg bg-muted/50 p-1">
                  <button
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-all",
                      selectedQueue === "regular"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setSelectedQueue("regular")}
                    type="button"
                  >
                    <Brain className="h-4 w-4" />
                    <Trans>Review</Trans>
                    {counts.regular > 0 && (
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 font-semibold text-xs",
                          selectedQueue === "regular"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted-foreground/20 text-muted-foreground"
                        )}
                      >
                        {formatNumber(counts.regular)}
                      </span>
                    )}
                  </button>
                  <button
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-all",
                      selectedQueue === "backlog"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setSelectedQueue("backlog")}
                    type="button"
                  >
                    <Archive className="h-4 w-4" />
                    <Trans>Backlog</Trans>
                    {counts.backlog > 0 && (
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 font-semibold text-xs",
                          selectedQueue === "backlog"
                            ? "bg-orange-500 text-white"
                            : "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                        )}
                      >
                        {formatNumber(counts.backlog)}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-center text-muted-foreground text-xs">
                {selectedQueue === "regular" ? (
                  <Trans>Cards due today or recently</Trans>
                ) : (
                  <Trans>Cards overdue by more than 7 days</Trans>
                )}
              </p>
            </>
          )}

          <div className="flex items-center justify-center gap-3">
            {cards?.length ? (
              <motion.div
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
                initial={{ scale: 0.8, opacity: 0 }}
              >
                <DrawerTitle className="text-md">
                  {formatNumber(cards.length)}{" "}
                  <Plural
                    one="card left"
                    other="cards left"
                    value={cards.length}
                  />
                </DrawerTitle>
              </motion.div>
            ) : (
              <motion.div
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-3"
                initial={{ scale: 0.8, opacity: 0 }}
              >
                <div className="rounded-2xl bg-green-500/10 p-3">
                  <PartyPopper className="h-8 w-8 text-green-500" />
                </div>
                <DrawerTitle className="text-center">
                  {selectedQueue === "backlog" ? (
                    <Trans>Backlog cleared!</Trans>
                  ) : (
                    <Trans>All done for today!</Trans>
                  )}
                </DrawerTitle>
                <p className="max-w-xs text-center text-muted-foreground text-sm">
                  {selectedQueue === "backlog" && counts.regular > 0 ? (
                    <Trans>
                      Great work on the backlog! You still have{" "}
                      {formatNumber(counts.regular)} regular reviews.
                    </Trans>
                  ) : counts.backlog > 0 ? (
                    <Trans>
                      You have {formatNumber(counts.backlog)} cards in your
                      backlog when you're ready.
                    </Trans>
                  ) : (
                    <Trans>Great work! Come back later for more reviews.</Trans>
                  )}
                </p>
              </motion.div>
            )}
          </div>

          <DrawerDescription className="sr-only">
            <Trans>
              Review your Arabic flashcards and grade your understanding with
              Again, Hard, Good, or Easy options to adjust scheduling.
            </Trans>
          </DrawerDescription>
        </DrawerHeader>

        {/* Card body */}
        <AnimatePresence mode="wait">
          {currentCard && (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 overflow-y-auto"
              exit={{ opacity: 0, x: -20 }}
              initial={{ opacity: 0, x: 20 }}
              key={currentCard.id}
              transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-y-4 px-4 py-4 sm:gap-y-6 sm:px-8 sm:py-6">
                <TagBadgesList currentCard={currentCard} />

                {/* Flashcard content area */}
                <div className="relative rounded-2xl border border-border/30 bg-gradient-to-br from-muted/30 to-muted/10 p-4 sm:p-8">
                  {currentCard.direction === "reverse" ? (
                    <>
                      <ReverseQuestionSide currentCard={currentCard} />
                      <AnimatePresence>
                        {showAnswer && (
                          <motion.div
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            initial={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="my-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                            <ReverseAnswerSide currentCard={currentCard} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <>
                      <QuestionSide currentCard={currentCard} />
                      <AnimatePresence>
                        {showAnswer && (
                          <motion.div
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            initial={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="my-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                            <AnswerSide currentCard={currentCard} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DrawerFooter>
          <AnimatePresence mode="wait">
            {schedulingCards && intervalLabels && showAnswer ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto flex w-full max-w-lg items-stretch justify-center gap-2 sm:gap-4"
                exit={{ opacity: 0, y: -10 }}
                initial={{ opacity: 0, y: 20 }}
                key="grading-buttons"
                transition={{ duration: 0.3 }}
              >
                {(
                  [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const
                ).map((grade) => (
                  <GradeOption
                    grade={grade}
                    intervalLabel={intervalLabels[grade]}
                    key={grade}
                    onClick={() => gradeCard(grade)}
                  />
                ))}
              </motion.div>
            ) : schedulingCards ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full justify-center"
                exit={{ opacity: 0, y: -10 }}
                initial={{ opacity: 0, y: 10 }}
                key="show-answer"
              >
                <Button
                  className={cn(
                    "w-full max-w-sm rtl:text-lg",
                    "bg-primary hover:bg-primary/90",
                    "shadow-lg shadow-primary/25 hover:shadow-primary/30 hover:shadow-xl",
                    "transition-all duration-300",
                    "group relative overflow-hidden"
                  )}
                  onClick={() => setShowAnswer(true)}
                  size="lg"
                >
                  <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-white/0 via-white/10 to-white/0 transition-transform duration-500 group-hover:translate-x-[100%]" />
                  <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  <Trans>Show answer</Trans>
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
