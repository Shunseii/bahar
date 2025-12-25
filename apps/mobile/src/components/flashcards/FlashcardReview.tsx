/**
 * Flashcard review screen component.
 *
 * Features:
 * - Card stack with animations
 * - FSRS scheduling integration
 * - Grade feedback
 * - Progress tracking
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { X } from "lucide-react-native";
import Animated, {
  FadeIn,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Brain, PartyPopper } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme";
import {
  createScheduler,
  gradeFlashcard,
  getSchedulingOptions,
  Rating,
  type Grade,
} from "@bahar/fsrs";
import { queryClient } from "../../utils/trpc";
import {
  flashcardsTable,
  FlashcardWithDictionaryEntry,
  FLASHCARD_LIMIT,
} from "../../lib/db/operations/flashcards";
import { decksTable } from "../../lib/db/operations/decks";
import { FlashcardCard } from "./FlashcardCard";
import { GradeButtons, ShowAnswerButton } from "./GradeButtons";
import { GradeFeedback } from "./GradeFeedback";
import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";

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
    queryFn: () =>
      flashcardsTable.today.query({ filters, showReverse }),
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
        is_hidden: currentCard.is_hidden,
      })
    : null;

  const handleFlip = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const handleGrade = useCallback(
    async (grade: Grade) => {
      if (!schedulingCards || !currentCard) return;

      // Show feedback animation
      setPendingGrade(grade);
    },
    [schedulingCards, currentCard],
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
    if (!schedulingCards || !currentCard || pendingGrade === null) return;

    const grade = pendingGrade;
    const updates = gradeFlashcard(scheduler, {
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
      is_hidden: currentCard.is_hidden,
    }, grade);

    // Update local state immediately
    setShowAnswer(false);
    setCards((prev) => prev.filter((c) => c.id !== currentCard.id));
    setPendingGrade(null);

    // Update local database
    await updateFlashcardLocal({
      id: currentCard.id,
      updates,
    });
  }, [schedulingCards, currentCard, pendingGrade, scheduler, updateFlashcardLocal]);

  // Loading state
  if (status === "pending") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Brain size={48} color={colors.primary} />
      </View>
    );
  }

  // Empty state
  if (!currentCard) {
    return (
      <View className="flex-1 bg-background">
        {/* Header with close button */}
        {onClose && (
          <View className="px-4 py-3 border-b border-border/30">
            <View className="flex-row items-center">
              <Pressable
                onPress={onClose}
                className="p-2 -ml-2 rounded-lg active:bg-muted"
              >
                <X size={24} color={colors.foreground} />
              </Pressable>
              <View className="flex-1" />
            </View>
          </View>
        )}

        <Animated.View
          entering={FadeIn.duration(300)}
          className="flex-1 items-center justify-center p-8"
        >
          <View className="items-center">
            <View className="p-6 rounded-3xl bg-success/10 mb-4">
              <PartyPopper size={48} color={colors.success} />
            </View>
            <Text className="text-foreground text-2xl font-bold text-center mb-2">
              All done for today!
            </Text>
            <Text className="text-muted-foreground text-center max-w-xs">
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
      <View className="px-4 py-3 border-b border-border/30">
        <View className="flex-row items-center">
          {/* Close button */}
          {onClose && (
            <Pressable
              onPress={onClose}
              className="p-2 -ml-2 rounded-lg active:bg-muted"
            >
              <X size={24} color={colors.foreground} />
            </Pressable>
          )}

          {/* Center content */}
          <View className="flex-1 flex-row items-center justify-center gap-2">
            <View className="p-2 rounded-xl bg-primary/10">
              <Brain size={20} color={colors.primary} />
            </View>
            <Text className="text-foreground font-semibold">
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
      <View className="flex-1 p-4 justify-center">
        {/* Grade feedback overlay */}
        <GradeFeedback
          grade={pendingGrade}
          onComplete={handleGradeComplete}
        />

        {/* Flashcard */}
        <Animated.View
          key={currentCard.id}
          entering={SlideInRight.duration(300).springify()}
          exiting={SlideOutLeft.duration(200)}
        >
          <FlashcardCard
            flashcard={currentCard}
            showAnswer={showAnswer}
            onFlip={handleFlip}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
          />
        </Animated.View>
      </View>

      {/* Footer with grade buttons */}
      <View className="pb-8 pt-4">
        {showAnswer && schedulingCards ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <GradeButtons
              schedulingCards={schedulingCards}
              onGrade={handleGrade}
              disabled={pendingGrade !== null}
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
