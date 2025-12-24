/**
 * Flashcard card component with flip animation.
 *
 * Features:
 * - Reveal animation on tap
 * - Swipe gestures for grading
 * - Spring physics for premium feel
 * - Haptic feedback
 */

import React, { useCallback, useEffect } from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  FadeIn,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { FlashcardWithDictionaryEntry } from "../../lib/db/operations/flashcards";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface FlashcardCardProps {
  flashcard: FlashcardWithDictionaryEntry;
  showAnswer: boolean;
  onFlip: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export const FlashcardCard: React.FC<FlashcardCardProps> = ({
  flashcard,
  showAnswer,
  onFlip,
  onSwipeLeft,
  onSwipeRight,
}) => {
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  // Use shared value for showAnswer so gesture handler can read it from UI thread
  const isAnswerShown = useSharedValue(showAnswer);

  // Sync shared value with prop
  useEffect(() => {
    isAnswerShown.value = showAnswer;
  }, [showAnswer, isAnswerShown]);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const triggerSuccessHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      rotation.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
        [-15, 0, 15],
        Extrapolation.CLAMP,
      );
    })
    .onEnd((event) => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });

      // Only allow swipe to complete if answer is shown (read from shared value)
      const canSwipe = isAnswerShown.value;

      if (event.translationX > SWIPE_THRESHOLD && canSwipe && onSwipeRight) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, { damping: 20, stiffness: 200 });
        runOnJS(triggerSuccessHaptic)();
        runOnJS(onSwipeRight)();
      } else if (event.translationX < -SWIPE_THRESHOLD && canSwipe && onSwipeLeft) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { damping: 20, stiffness: 200 });
        runOnJS(triggerHaptic)();
        runOnJS(onSwipeLeft)();
      } else {
        // Snap back to center
        translateX.value = withSpring(0, { damping: 20, stiffness: 400 });
        rotation.value = withSpring(0, { damping: 20, stiffness: 400 });
      }
    });

  const tapGesture = Gesture.Tap()
    .onStart(() => {
      runOnJS(triggerHaptic)();
      runOnJS(onFlip)();
    });

  const gesture = Gesture.Simultaneous(panGesture, tapGesture);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  // Gradient overlay based on swipe direction
  const leftOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [0.8, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const rightOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 0.8],
      Extrapolation.CLAMP,
    ),
  }));

  const isReverse = flashcard.direction === "reverse";
  const entry = flashcard.dictionary_entry;

  const typeLabels: Record<string, string> = {
    ism: "Noun",
    "fi'l": "Verb",
    harf: "Particle",
    expression: "Expression",
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[cardStyle]}
        className="bg-card rounded-3xl p-6 shadow-xl border border-border/50 min-h-[320px]"
      >
        {/* Swipe indicators */}
        <Animated.View
          style={[leftOverlayStyle, StyleSheet.absoluteFill]}
          className="rounded-3xl bg-destructive/20"
          pointerEvents="none"
        />
        <Animated.View
          style={[rightOverlayStyle, StyleSheet.absoluteFill]}
          className="rounded-3xl bg-green-500/20"
          pointerEvents="none"
        />

        {/* Card content */}
        <View className="flex-1 justify-center items-center py-4">
          {/* Question side */}
          {isReverse ? (
            <View className="items-center px-4">
              <Text className="text-foreground text-2xl text-center leading-relaxed">
                {entry.translation}
              </Text>
              {entry.definition && (
                <Text className="text-muted-foreground text-base text-center mt-3">
                  {entry.definition}
                </Text>
              )}
            </View>
          ) : (
            <View className="items-center px-4">
              <Text
                className="text-foreground text-4xl font-bold text-center"
                style={{ writingDirection: "rtl" }}
              >
                {entry.word}
              </Text>
              {entry.type && (
                <View className="mt-3 px-3 py-1 rounded-full bg-primary/10">
                  <Text className="text-primary text-sm font-medium">
                    {typeLabels[entry.type] || entry.type}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Answer side with animation */}
          {showAnswer && (
            <Animated.View
              entering={FadeIn.duration(200)}
              className="mt-6 pt-6 border-t border-border/50 w-full items-center"
            >
              {isReverse ? (
                <Text
                  className="text-foreground text-4xl font-bold text-center"
                  style={{ writingDirection: "rtl" }}
                >
                  {entry.word}
                </Text>
              ) : (
                <View className="items-center">
                  <Text className="text-foreground text-2xl text-center leading-relaxed">
                    {entry.translation}
                  </Text>
                  {entry.definition && (
                    <Text className="text-muted-foreground text-base text-center mt-3">
                      {entry.definition}
                    </Text>
                  )}
                </View>
              )}

              {/* Root letters */}
              {entry.root && entry.root.length > 0 && (
                <View className="mt-3 px-3 py-1 rounded-full bg-muted">
                  <Text className="text-muted-foreground text-sm" style={{ writingDirection: "rtl" }}>
                    {entry.root.join(" - ")}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <View className="flex-row flex-wrap justify-center gap-2 mt-2">
            {entry.tags.slice(0, 3).map((tag, index) => (
              <View key={index} className="bg-muted px-2.5 py-1 rounded-full">
                <Text className="text-muted-foreground text-xs">{tag}</Text>
              </View>
            ))}
            {entry.tags.length > 3 && (
              <View className="bg-muted px-2.5 py-1 rounded-full">
                <Text className="text-muted-foreground text-xs">+{entry.tags.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Tap hint */}
        {!showAnswer && (
          <Text className="text-muted-foreground/60 text-xs text-center mt-4">
            Tap to reveal answer
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
};
