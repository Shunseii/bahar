/**
 * Flashcard review screen component with two-queue system.
 *
 * Features:
 * - Regular / Backlog queue switching with animated tabs
 * - Card stack with animations
 * - FSRS scheduling integration
 * - Grade feedback
 */

import { cn } from "@bahar/design-system";
import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import {
  createScheduler,
  getSchedulingOptions,
  gradeFlashcard,
} from "@bahar/fsrs";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, Brain, PartyPopper, X } from "lucide-react-native";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import ReAnimated, { FadeIn, FadeOut } from "react-native-reanimated";
import { type Grade, Rating } from "ts-fsrs";
import { useThemeColors } from "@/lib/theme";
import { decksTable } from "../../lib/db/operations/decks";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  FLASHCARD_LIMIT,
  type FlashcardQueue,
  type FlashcardWithDictionaryEntry,
  flashcardsTable,
} from "../../lib/db/operations/flashcards";
import { queryClient } from "../../utils/api";
import { FlashcardCard } from "./FlashcardCard";
import { GradeButtons, ShowAnswerButton } from "./GradeButtons";
import { GradeFeedback } from "./GradeFeedback";

interface FlashcardReviewProps {
  filters?: SelectDeck["filters"];
  showReverse?: boolean;
  onClose?: () => void;
  initialQueue?: FlashcardQueue;
  queueCounts?: { regular: number; backlog: number };
}

const QueueTabs = ({
  selectedQueue,
  onSelectQueue,
  regularCount,
  backlogCount,
}: {
  selectedQueue: FlashcardQueue;
  onSelectQueue: (queue: FlashcardQueue) => void;
  regularCount: number;
  backlogCount: number;
}) => {
  const colors = useThemeColors();
  const isRegular = selectedQueue === "regular";
  const isBacklog = selectedQueue === "backlog";

  return (
    <View className="items-center px-4 pt-3 pb-1">
      <View className="flex-row gap-1 rounded-lg bg-muted/50 p-1">
        {/* Regular Tab */}
        <Pressable onPress={() => onSelectQueue("regular")}>
          <View
            className={cn(
              "flex-row items-center gap-1.5 rounded-lg px-3 py-1.5",
              isRegular && "bg-card shadow-sm"
            )}
          >
            <Brain
              color={isRegular ? colors.foreground : colors.mutedForeground}
              size={14}
            />
            <Text
              className={cn(
                "font-medium text-sm",
                isRegular ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Trans>Review</Trans>
            </Text>
            {regularCount > 0 && (
              <View
                className={cn(
                  "h-5 min-w-5 items-center justify-center rounded-full px-1.5",
                  isRegular ? "bg-primary" : "bg-muted-foreground/20"
                )}
              >
                <Text
                  className={cn(
                    "font-semibold text-xs",
                    isRegular
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {regularCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* Backlog Tab */}
        <Pressable onPress={() => onSelectQueue("backlog")}>
          <View
            className={cn(
              "flex-row items-center gap-1.5 rounded-lg px-3 py-1.5",
              isBacklog && "bg-card shadow-sm"
            )}
          >
            <Archive
              color={isBacklog ? colors.foreground : colors.mutedForeground}
              size={14}
            />
            <Text
              className={cn(
                "font-medium text-sm",
                isBacklog ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Trans>Backlog</Trans>
            </Text>
            {backlogCount > 0 && (
              <View
                className={cn(
                  "h-5 min-w-5 items-center justify-center rounded-full px-1.5",
                  isBacklog ? "bg-warning" : "bg-warning/20"
                )}
              >
                <Text
                  className={cn(
                    "font-semibold text-xs",
                    isBacklog ? "text-warning-foreground" : "text-warning"
                  )}
                >
                  {backlogCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {/* Queue description */}
      <Text className="mt-2 text-center text-muted-foreground text-xs">
        {isBacklog ? (
          <Trans>Cards overdue by more than 7 days</Trans>
        ) : (
          <Trans>Cards due today or recently</Trans>
        )}
      </Text>
    </View>
  );
};

export const FlashcardReview: React.FC<FlashcardReviewProps> = ({
  filters = {},
  showReverse = false,
  onClose,
  initialQueue = "regular",
  queueCounts,
}) => {
  const colors = useThemeColors();
  const [showAnswer, setShowAnswer] = useState(false);
  const [pendingGrade, setPendingGrade] = useState<Grade | null>(null);
  const [cards, setCards] = useState<FlashcardWithDictionaryEntry[]>([]);
  const [initialHasMore, setInitialHasMore] = useState(false);
  const [selectedQueue, setSelectedQueue] =
    useState<FlashcardQueue>(initialQueue);
  const scheduler = useMemo(() => createScheduler(), []);

  // Fetch counts if not provided
  const { data: fetchedCounts } = useQuery({
    queryFn: () =>
      flashcardsTable.counts.query({
        filters,
        showReverse,
        backlogThresholdDays: DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }),
    queryKey: [
      ...flashcardsTable.counts.cacheOptions.queryKey,
      showReverse,
      JSON.stringify(filters),
    ],
    enabled: !queueCounts,
  });

  const counts = queueCounts ?? fetchedCounts ?? { regular: 0, backlog: 0 };

  // Fetch flashcards for selected queue
  const { data, status } = useQuery({
    queryFn: () =>
      flashcardsTable.today.query({
        filters,
        showReverse,
        queue: selectedQueue,
        backlogThresholdDays: DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }),
    ...flashcardsTable.today.cacheOptions,
    queryKey: [
      ...flashcardsTable.today.cacheOptions.queryKey,
      showReverse,
      JSON.stringify(filters),
      selectedQueue,
    ],
  });

  useEffect(() => {
    if (data) {
      setCards(data);
      if (data.length > 0 && !initialHasMore) {
        setInitialHasMore(data.length > FLASHCARD_LIMIT);
      }
    }
  }, [data]);

  // Reset answer state when switching queues
  const handleSelectQueue = useCallback((queue: FlashcardQueue) => {
    setSelectedQueue(queue);
    setShowAnswer(false);
    setPendingGrade(null);
  }, []);

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

  const currentCard = cards[0] ?? null;
  const totalHits = cards.length;
  const hasMore = initialHasMore || totalHits > FLASHCARD_LIMIT;

  const schedulingCards = currentCard
    ? getSchedulingOptions(scheduler, {
        id: currentCard.id,
        dictionary_entry_id: currentCard.dictionary_entry_id,
        difficulty: currentCard.difficulty,
        due: currentCard.due,
        due_timestamp_ms: currentCard.due_timestamp_ms,
        elapsed_days: currentCard.elapsed_days,
        lapses: currentCard.lapses,
        last_review: currentCard.last_review,
        last_review_timestamp_ms: currentCard.last_review_timestamp_ms,
        reps: currentCard.reps,
        scheduled_days: currentCard.scheduled_days,
        stability: currentCard.stability,
        state: currentCard.state,
        direction: currentCard.direction,
        learning_steps: currentCard.learning_steps,
        is_hidden: currentCard.is_hidden,
      })
    : null;

  const handleFlip = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const handleGrade = useCallback(
    (grade: Grade) => {
      if (!(schedulingCards && currentCard)) return;
      setPendingGrade(grade);
    },
    [schedulingCards, currentCard]
  );

  const handleSwipeRight = useCallback(() => {
    if (showAnswer && schedulingCards) {
      handleGrade(Rating.Good);
    }
  }, [showAnswer, schedulingCards, handleGrade]);

  const handleSwipeLeft = useCallback(() => {
    if (showAnswer && schedulingCards) {
      handleGrade(Rating.Again);
    }
  }, [showAnswer, schedulingCards, handleGrade]);

  const handleGradeComplete = useCallback(async () => {
    if (!(schedulingCards && currentCard) || pendingGrade === null) return;

    const grade = pendingGrade;
    const updates = gradeFlashcard(
      scheduler,
      {
        id: currentCard.id,
        dictionary_entry_id: currentCard.dictionary_entry_id,
        difficulty: currentCard.difficulty,
        due: currentCard.due,
        due_timestamp_ms: currentCard.due_timestamp_ms,
        elapsed_days: currentCard.elapsed_days,
        lapses: currentCard.lapses,
        last_review: currentCard.last_review,
        last_review_timestamp_ms: currentCard.last_review_timestamp_ms,
        reps: currentCard.reps,
        scheduled_days: currentCard.scheduled_days,
        stability: currentCard.stability,
        state: currentCard.state,
        direction: currentCard.direction,
        learning_steps: currentCard.learning_steps,
        is_hidden: currentCard.is_hidden,
      },
      grade
    );

    setShowAnswer(false);
    setCards((prev) => prev.filter((c) => c.id !== currentCard.id));
    setPendingGrade(null);

    await updateFlashcardLocal({
      id: currentCard.id,
      updates,
    });
  }, [
    schedulingCards,
    currentCard,
    pendingGrade,
    scheduler,
    updateFlashcardLocal,
  ]);

  if (status === "pending") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Brain color={colors.primary} size={48} />
      </View>
    );
  }

  // Empty state — context-aware based on which queue is empty
  if (!currentCard) {
    const otherQueueHasCards =
      selectedQueue === "regular" ? counts.backlog > 0 : counts.regular > 0;

    return (
      <View className="flex-1 bg-background">
        {onClose && (
          <View className="border-border/30 border-b px-4 py-3">
            <View className="flex-row items-center">
              <Pressable
                className="-ml-2 rounded-lg p-2 active:bg-muted"
                onPress={onClose}
              >
                <X color={colors.foreground} size={24} />
              </Pressable>
              <View className="flex-1" />
            </View>
          </View>
        )}

        <QueueTabs
          backlogCount={counts.backlog}
          onSelectQueue={handleSelectQueue}
          regularCount={counts.regular}
          selectedQueue={selectedQueue}
        />

        <ReAnimated.View
          className="flex-1 items-center justify-center p-8"
          entering={FadeIn.duration(300)}
        >
          <View className="items-center">
            <View className="mb-4 rounded-3xl bg-success/10 p-6">
              <PartyPopper color={colors.success} size={48} />
            </View>
            <Text className="mb-2 text-center font-bold text-2xl text-foreground">
              {selectedQueue === "regular" ? (
                <Trans>Regular reviews done!</Trans>
              ) : (
                <Trans>Backlog cleared!</Trans>
              )}
            </Text>
            <Text className="max-w-xs text-center text-muted-foreground">
              {otherQueueHasCards ? (
                selectedQueue === "regular" ? (
                  <Trans>
                    You still have backlog cards to review. Switch to the
                    Backlog tab to tackle them.
                  </Trans>
                ) : (
                  <Trans>
                    Switch to the Review tab if you have regular cards due.
                  </Trans>
                )
              ) : (
                <Trans>Great work! Come back later for more reviews.</Trans>
              )}
            </Text>
          </View>
        </ReAnimated.View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="border-border/30 border-b px-4 py-3">
        <View className="flex-row items-center">
          {onClose && (
            <Pressable
              className="-ml-2 rounded-lg p-2 active:bg-muted"
              onPress={onClose}
            >
              <X color={colors.foreground} size={24} />
            </Pressable>
          )}

          <View className="flex-1 flex-row items-center justify-center gap-2">
            <View className="rounded-xl bg-primary/10 p-2">
              <Brain color={colors.primary} size={20} />
            </View>
            <Text className="font-semibold text-foreground">
              {hasMore
                ? `${FLASHCARD_LIMIT}+ cards`
                : `${cards.length} card${cards.length === 1 ? "" : "s"} left`}
            </Text>
          </View>

          {onClose && <View className="w-10" />}
        </View>
      </View>

      {/* Queue Tabs */}
      <QueueTabs
        backlogCount={counts.backlog}
        onSelectQueue={handleSelectQueue}
        regularCount={counts.regular}
        selectedQueue={selectedQueue}
      />

      {/* Card area */}
      <View className="flex-1 justify-center p-4">
        <GradeFeedback grade={pendingGrade} onComplete={handleGradeComplete} />

        <ReAnimated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          key={`${selectedQueue}-${currentCard.id}`}
        >
          <FlashcardCard
            flashcard={currentCard}
            onFlip={handleFlip}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            showAnswer={showAnswer}
          />
        </ReAnimated.View>
      </View>

      {/* Footer with grade buttons */}
      <View className="pt-4 pb-8">
        {showAnswer && schedulingCards ? (
          <ReAnimated.View entering={FadeIn.duration(200)}>
            <GradeButtons
              disabled={pendingGrade !== null}
              onGrade={handleGrade}
              schedulingCards={schedulingCards}
            />
          </ReAnimated.View>
        ) : (
          <ReAnimated.View entering={FadeIn.duration(200)}>
            <ShowAnswerButton onPress={handleFlip} />
          </ReAnimated.View>
        )}
      </View>
    </View>
  );
};
