import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import { Button } from "../../ui/button";
import { intlFormatDistance } from "date-fns";
import { Card, fsrs, Grade, Rating } from "ts-fsrs";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "../../ui/drawer";
import {
  FC,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RouterOutput, trpc } from "@/lib/trpc";
import { queryClient } from "@/lib/query";
import { motion, AnimatePresence } from "motion/react";
import { useDir } from "@/hooks/useDir";
import { Badge } from "../../ui/badge";
import { QuestionSide } from "./QuestionSide";
import { AnswerSide } from "./AnswerSide";
import { ReverseAnswerSide } from "./ReverseAnswerSide";
import { ReverseQuestionSide } from "./ReverseQuestionSide";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  flashcardsTable,
  FlashcardWithDictionaryEntry,
  FlashcardQueue,
} from "@/lib/db/operations/flashcards";
import { decksTable } from "@/lib/db/operations/decks";
import {
  FlashcardState,
  SelectDeck,
  SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { cn } from "@bahar/design-system";
import {
  RotateCcw,
  Brain,
  ThumbsUp,
  Zap,
  Sparkles,
  PartyPopper,
  Archive,
} from "lucide-react";

const convertFlashcardToFsrsCard = (
  flashcard: SelectFlashcard,
): Card & { id: string } => {
  return {
    ...flashcard,
    due: new Date(flashcard.due),
    stability: flashcard.stability ?? 0,
    difficulty: flashcard.difficulty ?? 0,
    elapsed_days: flashcard.elapsed_days ?? 0,
    scheduled_days: flashcard.scheduled_days ?? 0,
    reps: flashcard.reps ?? 0,
    lapses: flashcard.lapses ?? 0,
    state: flashcard.state ?? FlashcardState.NEW,
    last_review: flashcard.last_review
      ? new Date(flashcard.last_review)
      : undefined,
  };
};

const getTranslatedType = (str: "ism" | "fi'l" | "harf" | "expression") => {
  switch (str) {
    case "ism":
      return t`Noun`;
    case "fi'l":
      return t`Verb`;
    case "harf":
      return t`Preposition`;
    case "expression":
      return t`Expression`;
  }
};

interface FlashcardDrawerProps extends PropsWithChildren {
  filters?: SelectDeck["filters"];
  show_reverse?: boolean;
  initialQueue?: FlashcardQueue;
  /** If provided, shows queue counts and allows switching between queues */
  queueCounts?: { regular: number; backlog: number };
}

export type Flashcard = RouterOutput["flashcard"]["today"]["flashcards"][0];

const GradeFeedback: FC<{
  grade: Grade | null;
  onComplete: () => void;
}> = ({ grade, onComplete }) => {
  useEffect(() => {
    if (grade === null) return;

    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [grade, onComplete]);

  if (grade === null) return null;

  const feedbackConfig = {
    [Rating.Again]: {
      icon: RotateCcw,
      color: "text-muted-foreground",
      bgColor: "bg-muted/20",
      animation: {
        initial: { scale: 0, rotate: 0 },
        animate: {
          scale: [0, 1.2, 1],
          rotate: [0, -10, 10, -10, 0],
        },
        transition: { duration: 0.5 },
      },
    },
    [Rating.Hard]: {
      icon: Brain,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      animation: {
        initial: { scale: 0 },
        animate: {
          scale: [0, 1.3, 1],
          opacity: [0, 1, 1],
        },
        transition: { duration: 0.5, ease: "easeOut" },
      },
    },
    [Rating.Good]: {
      icon: ThumbsUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
      animation: {
        initial: { scale: 0, y: 10, opacity: 0 },
        animate: {
          scale: 1,
          y: 0,
          opacity: 1,
        },
        transition: {
          duration: 0.4,
          type: "spring",
          stiffness: 200,
          damping: 15,
        },
      },
    },
    [Rating.Easy]: {
      icon: Zap,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      animation: {
        initial: { scale: 0, rotate: -20 },
        animate: {
          scale: [0, 1.4, 1],
          rotate: [-20, 10, 0],
        },
        transition: { duration: 0.4, ease: "easeOut" },
      },
    },
  };

  const config = feedbackConfig[grade];
  const Icon = config.icon;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background pulse */}
      <motion.div
        className={cn("absolute inset-0", config.bgColor)}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 0.6 }}
      />

      {/* Icon animation */}
      <motion.div
        className={cn("p-6 rounded-full", config.bgColor)}
        {...config.animation}
      >
        <Icon className={cn("w-16 h-16", config.color)} />
      </motion.div>

      {/* Sparkles for Easy */}
      {grade === Rating.Easy && (
        <>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-green-400"
              initial={{
                scale: 0,
                x: 0,
                y: 0,
              }}
              animate={{
                scale: [0, 1, 0],
                x: Math.cos((i * Math.PI * 2) / 6) * 80,
                y: Math.sin((i * Math.PI * 2) / 6) * 80,
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.5,
                delay: 0.1,
              }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
};

const TagBadgesList: FC<{
  currentCard: FlashcardWithDictionaryEntry;
}> = ({ currentCard }) => {
  return (
    <motion.ul
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-wrap gap-2"
    >
      {!!currentCard.dictionary_entry.type && (
        <Badge
          variant="secondary"
          className="w-max bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors"
        >
          {getTranslatedType(currentCard.dictionary_entry.type)}
        </Badge>
      )}
      {currentCard.dictionary_entry.tags?.map((tag, index) => (
        <motion.div
          key={tag}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 + index * 0.05 }}
        >
          <Badge
            variant="outline"
            className="w-max border-border/50 hover:border-border transition-colors"
          >
            {tag}
          </Badge>
        </motion.div>
      ))}
    </motion.ul>
  );
};

export const FlashcardDrawer: FC<FlashcardDrawerProps> = ({
  children,
  filters = {},
  show_reverse = false,
  initialQueue = "regular",
  queueCounts,
}) => {
  const dir = useDir();
  const locale = dir === "rtl" ? "ar-u-nu-arab" : "en";
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
  const { mutateAsync: updateFlashcard } = trpc.flashcard.update.useMutation({
    // TODO: Remove this with dual write logic
    // onMutate: async (updatedCard) => {
    //   const todayQueryKey = getQueryKey(
    //     trpc.flashcard.today,
    //     { filters, show_reverse },
    //     "query",
    //   );
    //
    //   await queryClient.cancelQueries({
    //     queryKey: todayQueryKey,
    //     exact: false,
    //   });
    //
    //   // TODO: when you have 101 cards, grading the next one will cause the
    //   // number to be off by one until the server response comes back.
    //   // This is due to the optimistic update.
    //
    //   queryClient.setQueryData(todayQueryKey, (old: typeof data) => ({
    //     total_hits: (old?.length ?? 0) - 1,
    //     flashcards:
    //       old?.filter(
    //         (card) =>
    //           card.id !== updatedCard.id ||
    //           (card.direction === "reverse") !== updatedCard.reverse,
    //       ) ?? [],
    //   }));
    // },
    // onSettled: async () => {
    //   const todayQueryKey = getQueryKey(
    //     trpc.flashcard.today,
    //     undefined,
    //     "query",
    //   );
    //   const deckListQueryKey = getQueryKey(trpc.decks.list, undefined, "query");
    //
    //   await queryClient.invalidateQueries({
    //     queryKey: deckListQueryKey,
    //   });
    //
    //   await queryClient.invalidateQueries({
    //     queryKey: todayQueryKey,
    //     exact: false,
    //   });
    // },
  });

  const { mutateAsync: updateFlashcardLocal } = useMutation({
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
    const scheduling_cards = f.repeat(convertFlashcardToFsrsCard(currentCard), now);
    return { scheduling_cards, now };
  }, [currentCard, f]);

  const scheduling_cards = schedulingData?.scheduling_cards;
  const now = schedulingData?.now ?? new Date();

  const executeGrade = useCallback(
    async (grade: Grade) => {
      if (!scheduling_cards || !currentCard) return;

      const selectedCard = scheduling_cards[grade].card;
      const dueTimestamp = Math.floor(selectedCard.due.getTime() / 1000);
      const dueTimestampMs = selectedCard.due.getTime();
      const lastReviewTimestamp = selectedCard?.last_review
        ? Math.floor(selectedCard.last_review.getTime() / 1000)
        : null;
      const lastReviewTimestampMs = selectedCard?.last_review
        ? selectedCard.last_review.getTime()
        : null;

      const newCard = {
        ...selectedCard,
        id: currentCard.id,
        due: selectedCard.due.toISOString(),
        last_review: selectedCard?.last_review?.toISOString() ?? null,
        due_timestamp: dueTimestamp,
        last_review_timestamp: lastReviewTimestamp,
      };

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

      updateFlashcard({
        flashcard: newCard,
        id: newCard.id,
        reverse: currentCard.direction === "reverse",
      });

      await updateFlashcardLocal({
        id: currentCard.id,
        updates: localUpdates,
      });
    },
    [currentCard, scheduling_cards, updateFlashcard, updateFlashcardLocal],
  );

  const gradeCard = useCallback(
    (grade: Grade) => {
      if (!scheduling_cards || !currentCard) return;

      // Store the callback to execute after animation
      gradeCallbackRef.current = () => executeGrade(grade);

      // Show feedback animation
      setPendingGrade(grade);
    },
    [currentCard, scheduling_cards, executeGrade],
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
        {/* Grade feedback animation overlay */}
        <AnimatePresence>
          {pendingGrade !== null && (
            <GradeFeedback
              grade={pendingGrade}
              onComplete={handleAnimationComplete}
            />
          )}
        </AnimatePresence>

        <DrawerHeader className="border-b border-border/30 pb-4">
          {/* Queue selector */}
          {(counts.regular > 0 || counts.backlog > 0) && (
            <>
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="inline-flex rounded-lg bg-muted/50 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedQueue("regular")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                      selectedQueue === "regular"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Brain className="w-4 h-4" />
                    <Trans>Review</Trans>
                    {counts.regular > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full",
                          selectedQueue === "regular"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted-foreground/20 text-muted-foreground",
                        )}
                      >
                        {formatNumber(counts.regular)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQueue("backlog")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                      selectedQueue === "backlog"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Archive className="w-4 h-4" />
                    <Trans>Backlog</Trans>
                    {counts.backlog > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full",
                          selectedQueue === "backlog"
                            ? "bg-orange-500 text-white"
                            : "bg-orange-500/20 text-orange-600 dark:text-orange-400",
                        )}
                      >
                        {formatNumber(counts.backlog)}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
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
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
              >
                <DrawerTitle className="text-md">
                  {formatNumber(cards.length)}{" "}
                  <Plural
                    value={cards.length}
                    one="card left"
                    other="cards left"
                  />
                </DrawerTitle>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="p-3 rounded-2xl bg-green-500/10">
                  <PartyPopper className="w-8 h-8 text-green-500" />
                </div>
                <DrawerTitle className="text-center">
                  {selectedQueue === "backlog" ? (
                    <Trans>Backlog cleared!</Trans>
                  ) : (
                    <Trans>All done for today!</Trans>
                  )}
                </DrawerTitle>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
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
              key={currentCard.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
              className="flex-1 overflow-y-auto"
            >
              <div className="w-full max-w-2xl mx-auto flex flex-col gap-y-4 sm:gap-y-6 px-4 sm:px-8 py-4 sm:py-6">
                <TagBadgesList currentCard={currentCard} />

                {/* Flashcard content area */}
                <div className="relative p-4 sm:p-8 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/30">
                  {currentCard.direction === "reverse" ? (
                    <>
                      <ReverseQuestionSide currentCard={currentCard} />
                      <AnimatePresence>
                        {showAnswer && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
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
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
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
            {scheduling_cards && showAnswer ? (
              <motion.div
                key="grading-buttons"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex gap-2 sm:gap-4 items-stretch justify-center w-full max-w-lg mx-auto"
              >
                {/* Again Button */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 }}
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    onClick={() => gradeCard(Rating.Again)}
                    disabled={pendingGrade !== null}
                    className={cn(
                      "w-full h-auto flex-col gap-1 py-3 px-2 sm:px-4",
                      "border-2 border-muted-foreground/20 hover:border-muted-foreground/40",
                      "hover:bg-muted/50 transition-all duration-200",
                      "group",
                    )}
                  >
                    <RotateCcw className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="font-medium">
                      <Trans>Again</Trans>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {intlFormatDistance(
                        scheduling_cards[Rating.Again].card.due,
                        now,
                        { style: "narrow", locale },
                      )}
                    </span>
                  </Button>
                </motion.div>

                {/* Hard Button */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    onClick={() => gradeCard(Rating.Hard)}
                    disabled={pendingGrade !== null}
                    className={cn(
                      "w-full h-auto flex-col gap-1 py-3 px-2 sm:px-4",
                      "border-2 border-orange-500/30 hover:border-orange-500/50",
                      "hover:bg-orange-500/10 transition-all duration-200",
                      "group",
                    )}
                  >
                    <Brain className="w-5 h-5 text-orange-500" />
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      <Trans>Hard</Trans>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {intlFormatDistance(
                        scheduling_cards[Rating.Hard].card.due,
                        now,
                        { style: "narrow", locale },
                      )}
                    </span>
                  </Button>
                </motion.div>

                {/* Good Button */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    onClick={() => gradeCard(Rating.Good)}
                    disabled={pendingGrade !== null}
                    className={cn(
                      "w-full h-auto flex-col gap-1 py-3 px-2 sm:px-4",
                      "border-2 border-primary/30 hover:border-primary/50",
                      "hover:bg-primary/10 transition-all duration-200",
                      "group",
                    )}
                  >
                    <ThumbsUp className="w-5 h-5 text-primary" />
                    <span className="font-medium text-primary">
                      <Trans>Good</Trans>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {intlFormatDistance(
                        scheduling_cards[Rating.Good].card.due,
                        now,
                        { style: "narrow", locale },
                      )}
                    </span>
                  </Button>
                </motion.div>

                {/* Easy Button */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    onClick={() => gradeCard(Rating.Easy)}
                    disabled={pendingGrade !== null}
                    className={cn(
                      "w-full h-auto flex-col gap-1 py-3 px-2 sm:px-4",
                      "border-2 border-green-500/30 hover:border-green-500/50",
                      "hover:bg-green-500/10 transition-all duration-200",
                      "group",
                    )}
                  >
                    <Zap className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-600 dark:text-green-400">
                      <Trans>Easy</Trans>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {intlFormatDistance(
                        scheduling_cards[Rating.Easy].card.due,
                        now,
                        { style: "narrow", locale },
                      )}
                    </span>
                  </Button>
                </motion.div>
              </motion.div>
            ) : scheduling_cards ? (
              <motion.div
                key="show-answer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex justify-center"
              >
                <Button
                  onClick={() => setShowAnswer(true)}
                  size="lg"
                  className={cn(
                    "w-full max-w-sm rtl:text-lg",
                    "bg-primary hover:bg-primary/90",
                    "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
                    "transition-all duration-300",
                    "group relative overflow-hidden",
                  )}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                  <Sparkles className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
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
