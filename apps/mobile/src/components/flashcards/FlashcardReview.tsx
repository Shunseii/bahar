/**
 * Flashcard review screen component.
 *
 * Features:
 * - Card stack with animations
 * - FSRS scheduling integration
 * - Grade feedback
 * - Progress tracking
 */

import { cn } from "@bahar/design-system";
import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import {
  createScheduler,
  getSchedulingOptions,
  gradeFlashcard,
} from "@bahar/fsrs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Brain, PartyPopper, X } from "lucide-react-native";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { type Grade, Rating } from "ts-fsrs";
import { useThemeColors } from "@/lib/theme";
import { decksTable } from "../../lib/db/operations/decks";
import {
  FLASHCARD_LIMIT,
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
}

export const FlashcardReview: React.FC<FlashcardReviewProps> = ({
  filters = {},
  showReverse = false,
  onClose,
}) => {
  const colors = useThemeColors();
  const [showAnswer, setShowAnswer] = useState(false);
  const [pendingGrade, setPendingGrade] = useState<Grade | null>(null);
  const [cards, setCards] = useState<FlashcardWithDictionaryEntry[]>([]);
  const [initialHasMore, setInitialHasMore] = useState(false);

  const scheduler = useMemo(() => createScheduler(), []);

  // Fetch flashcards
  const { data, status } = useQuery({
    queryFn: () => flashcardsTable.today.query({ filters, showReverse }),
    ...flashcardsTable.today.cacheOptions,
    queryKey: [
      ...flashcardsTable.today.cacheOptions.queryKey,
      showReverse,
      JSON.stringify(filters),
    ],
  });

  // Sync cards state with query data and track initial hasMore
  useEffect(() => {
    if (data) {
      setCards(data);
      // Only set initialHasMore once when data first loads
      if (data.length > 0 && !initialHasMore) {
        setInitialHasMore(data.length > FLASHCARD_LIMIT);
      }
    }
  }, [data]);

  // Mutation for local updates
  const { mutateAsync: updateFlashcardLocal } = useMutation({
    mutationFn: flashcardsTable.update.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
    },
  });

  const currentCard = cards[0] ?? null;
  const totalHits = cards.length;
  // Use initialHasMore to prevent flickering when cards are graded
  const hasMore = initialHasMore || totalHits > FLASHCARD_LIMIT;

  // Get scheduling options for current card
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

      // Show feedback animation
      setPendingGrade(grade);
    },
    [schedulingCards, currentCard]
  );

  const handleSwipeRight = useCallback(() => {
    if (showAnswer && schedulingCards) {
      // Swipe right = Good rating
      handleGrade(Rating.Good);
    }
  }, [showAnswer, schedulingCards, handleGrade]);

  const handleSwipeLeft = useCallback(() => {
    if (showAnswer && schedulingCards) {
      // Swipe left = Again rating
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

    // Update local state immediately
    setShowAnswer(false);
    setCards((prev) => prev.filter((c) => c.id !== currentCard.id));
    setPendingGrade(null);

    // Update local database
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
        <Brain className={cn("text-primary")} size={48} />
      </View>
    );
  }

  if (!currentCard) {
    return (
      <View className="flex-1 bg-background">
        {/* Header with close button */}
        {onClose && (
          <View className="border-border/30 border-b px-4 py-3">
            <View className="flex-row items-center">
              <Pressable
                className="-ml-2 rounded-lg p-2 active:bg-muted"
                onPress={onClose}
              >
                <X className="text-foreground" size={24} />
              </Pressable>
              <View className="flex-1" />
            </View>
          </View>
        )}

        <Animated.View
          className="flex-1 items-center justify-center p-8"
          entering={FadeIn.duration(300)}
        >
          <View className="items-center">
            <View className="mb-4 rounded-3xl bg-success/10 p-6">
              <PartyPopper className="text-success" size={48} />
            </View>
            <Text className="mb-2 text-center font-bold text-2xl text-foreground">
              All done for today!
            </Text>
            <Text className="max-w-xs text-center text-muted-foreground">
              Great work! Come back later for more reviews.
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="border-border/30 border-b px-4 py-3">
        <View className="flex-row items-center">
          {/* Close button */}
          {onClose && (
            <Pressable
              className="-ml-2 rounded-lg p-2 active:bg-muted"
              onPress={onClose}
            >
              <X className="text-foreground" size={24} />
            </Pressable>
          )}

          {/* Center content */}
          <View className="flex-1 flex-row items-center justify-center gap-2">
            <View className="rounded-xl bg-primary/10 p-2">
              <Brain className="text-primary" size={20} />
            </View>
            <Text className="font-semibold text-foreground">
              {hasMore
                ? `${FLASHCARD_LIMIT}+ cards to review`
                : `${cards.length} card${cards.length === 1 ? "" : "s"} left`}
            </Text>
          </View>

          {/* Spacer for balance */}
          {onClose && <View className="w-10" />}
        </View>
      </View>

      {/* Card area */}
      <View className="flex-1 justify-center p-4">
        <GradeFeedback grade={pendingGrade} onComplete={handleGradeComplete} />

        <Animated.View
          entering={SlideInRight.duration(300).springify()}
          exiting={SlideOutLeft.duration(200)}
          key={currentCard.id}
        >
          <FlashcardCard
            flashcard={currentCard}
            onFlip={handleFlip}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            showAnswer={showAnswer}
          />
        </Animated.View>
      </View>

      {/* Footer with grade buttons */}
      <View className="pt-4 pb-8">
        {showAnswer && schedulingCards ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <GradeButtons
              disabled={pendingGrade !== null}
              onGrade={handleGrade}
              schedulingCards={schedulingCards}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)}>
            <ShowAnswerButton onPress={handleFlip} />
          </Animated.View>
        )}
      </View>
    </View>
  );
};
