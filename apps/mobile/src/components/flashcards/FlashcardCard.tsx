/**
 * Flashcard card component with reveal animation, swipe-to-grade, and
 * scrollable answer side that surfaces the full morphology data model.
 */

import { Trans } from "@lingui/react/macro";
import * as Haptics from "expo-haptics";
import { ChevronDown } from "lucide-react-native";
import type React from "react";
import { useCallback, useEffect } from "react";
import {
  Dimensions,
  I18nManager,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { FlashcardWithDictionaryEntry } from "../../lib/db/operations/flashcards";
import {
  ExamplesSection,
  HuroofSection,
  MorphologySection,
  PropertiesRow,
  RootRow,
} from "./card";
import { Divider } from "./card/shared";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_ACTIVATE_OFFSET = 20;
const SCROLL_FAIL_OFFSET = 15;

interface FlashcardCardProps {
  flashcard: FlashcardWithDictionaryEntry;
  showAnswer: boolean;
  onFlip: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const TagsRow: React.FC<{ tags: string[] }> = ({ tags }) => {
  if (tags.length === 0) return null;
  return (
    <View className="w-full flex-row flex-wrap justify-center gap-1.5">
      {tags.map((tag) => (
        <View className="rounded-full bg-muted px-2.5 py-0.5" key={tag}>
          <Text className="text-[11px] text-muted-foreground">{tag}</Text>
        </View>
      ))}
    </View>
  );
};

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
  const isRTL = I18nManager.isRTL;
  const isAnswerShown = useSharedValue(showAnswer);

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
    .activeOffsetX([-SWIPE_ACTIVATE_OFFSET, SWIPE_ACTIVATE_OFFSET])
    .failOffsetY([-SCROLL_FAIL_OFFSET, SCROLL_FAIL_OFFSET])
    .onStart(() => {
      if (!isAnswerShown.value) return;
      scale.value = withTiming(0.98, { duration: 150 });
    })
    .onUpdate((event) => {
      if (!isAnswerShown.value) return;
      translateX.value = event.translationX;
      rotation.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
        [-15, 0, 15],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      if (!isAnswerShown.value) return;
      scale.value = withTiming(1, { duration: 150 });

      const swipedRight = event.translationX > SWIPE_THRESHOLD;
      const swipedLeft = event.translationX < -SWIPE_THRESHOLD;
      const goodSwipe = isRTL ? swipedLeft : swipedRight;
      const againSwipe = isRTL ? swipedRight : swipedLeft;

      if (goodSwipe && onSwipeRight) {
        translateX.value = withTiming((isRTL ? -1 : 1) * SCREEN_WIDTH * 1.5, {
          duration: 250,
          easing: Easing.out(Easing.ease),
        });
        runOnJS(triggerSuccessHaptic)();
        runOnJS(onSwipeRight)();
      } else if (againSwipe && onSwipeLeft) {
        translateX.value = withTiming((isRTL ? 1 : -1) * SCREEN_WIDTH * 1.5, {
          duration: 250,
          easing: Easing.out(Easing.ease),
        });
        runOnJS(triggerHaptic)();
        runOnJS(onSwipeLeft)();
      } else {
        translateX.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.ease),
        });
        rotation.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.ease),
        });
      }
    });

  const tapGesture = Gesture.Tap().onStart(() => {
    runOnJS(triggerHaptic)();
    runOnJS(onFlip)();
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const againOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      isRTL ? [0, SWIPE_THRESHOLD] : [-SWIPE_THRESHOLD, 0],
      isRTL ? [0, 0.8] : [0.8, 0],
      Extrapolation.CLAMP
    ),
  }));

  const goodOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      isRTL ? [-SWIPE_THRESHOLD, 0] : [0, SWIPE_THRESHOLD],
      isRTL ? [0.8, 0] : [0, 0.8],
      Extrapolation.CLAMP
    ),
  }));

  const isReverse = flashcard.direction === "reverse";
  const entry = flashcard.dictionary_entry;
  const tags = entry.tags ?? [];
  const examples = entry.examples ?? [];
  const ism = entry.morphology?.ism;
  const verb = entry.morphology?.verb;

  // Q-side gesture: just tap (swipe disabled until answer shown)
  // A-side gesture: pan composes with native scroll via offset thresholds
  const composedGesture = showAnswer
    ? Gesture.Simultaneous(panGesture, tapGesture)
    : tapGesture;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        className="overflow-hidden rounded-3xl border border-border/50 bg-card shadow-xl"
        style={[cardStyle]}
      >
        <Animated.View
          className="rounded-3xl bg-muted-foreground/20"
          pointerEvents="none"
          style={[againOverlayStyle, StyleSheet.absoluteFill]}
        />
        <Animated.View
          className="rounded-3xl bg-primary/20"
          pointerEvents="none"
          style={[goodOverlayStyle, StyleSheet.absoluteFill]}
        />

        {showAnswer ? (
          <ScrollView showsVerticalScrollIndicator style={styles.scroll}>
            <AnswerContent
              entry={entry}
              examples={examples}
              ism={ism}
              isReverse={isReverse}
              tags={tags}
              verb={verb}
            />
          </ScrollView>
        ) : (
          <QuestionContent entry={entry} isReverse={isReverse} tags={tags} />
        )}
      </Animated.View>
    </GestureDetector>
  );
};

interface QuestionContentProps {
  entry: FlashcardWithDictionaryEntry["dictionary_entry"];
  isReverse: boolean;
  tags: string[];
}

const QuestionContent: React.FC<QuestionContentProps> = ({
  entry,
  isReverse,
  tags,
}) => (
  <View className="min-h-[320px] justify-between gap-6 p-6">
    <TagsRow tags={tags} />
    <View className="flex-1 items-center justify-center gap-4">
      {isReverse ? (
        <Text className="text-center font-bold text-3xl text-foreground leading-relaxed">
          {entry.translation}
        </Text>
      ) : (
        <Text
          className="text-center font-bold text-4xl text-foreground leading-relaxed"
          style={{ writingDirection: "rtl" }}
        >
          {entry.word}
        </Text>
      )}
      <View className="rounded-full bg-muted px-3 py-1">
        <Text className="font-medium text-foreground text-sm">
          <TypeLabel type={entry.type} />
        </Text>
      </View>
    </View>
    <View className="items-center gap-1">
      <Text className="text-muted-foreground/60 text-xs">
        {isReverse ? (
          <Trans>Recall the Arabic word</Trans>
        ) : (
          <Trans>Tap to reveal answer</Trans>
        )}
      </Text>
      <ChevronDown color="#A4A6BB" size={16} />
    </View>
  </View>
);

interface AnswerContentProps {
  entry: FlashcardWithDictionaryEntry["dictionary_entry"];
  isReverse: boolean;
  tags: string[];
  examples: NonNullable<
    FlashcardWithDictionaryEntry["dictionary_entry"]["examples"]
  >;
  ism: NonNullable<
    FlashcardWithDictionaryEntry["dictionary_entry"]["morphology"]
  >["ism"];
  verb: NonNullable<
    FlashcardWithDictionaryEntry["dictionary_entry"]["morphology"]
  >["verb"];
}

const AnswerContent: React.FC<AnswerContentProps> = ({
  entry,
  isReverse: _isReverse,
  tags,
  examples,
  ism,
  verb,
}) => (
  <Animated.View
    className="w-full items-center gap-3.5 px-5 py-5"
    entering={FadeIn.duration(200)}
  >
    {tags.length > 0 && <TagsRow tags={tags} />}

    <View className="items-center gap-1">
      <Text
        className="text-center font-bold text-3xl text-foreground leading-relaxed"
        style={{ writingDirection: "rtl" }}
      >
        {entry.word}
      </Text>
      <Text className="text-center font-medium text-foreground text-xl">
        {entry.translation}
      </Text>
    </View>

    <PropertiesRow morphology={entry.morphology} type={entry.type} />

    {entry.definition && (
      <Text className="text-center text-[13px] text-muted-foreground italic">
        {entry.definition}
      </Text>
    )}

    {entry.root && entry.root.length > 0 && (
      <>
        <Divider />
        <RootRow root={entry.root} />
      </>
    )}

    {examples.length > 0 && (
      <>
        <Divider />
        <ExamplesSection examples={examples} />
      </>
    )}

    {hasMorphology(ism, verb) && (
      <>
        <Divider />
        <MorphologySection morphology={entry.morphology} />
      </>
    )}

    {verb?.huroof && verb.huroof.length > 0 && (
      <>
        <Divider />
        <HuroofSection baseWord={entry.word} verb={verb} />
      </>
    )}
  </Animated.View>
);

const TypeLabel: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case "ism":
      return <Trans>Ism</Trans>;
    case "fi'l":
      return <Trans>Fi'l</Trans>;
    case "harf":
      return <Trans>Harf</Trans>;
    case "expression":
      return <Trans>Expression</Trans>;
    default:
      return <>{type}</>;
  }
};

type Morph = FlashcardWithDictionaryEntry["dictionary_entry"]["morphology"];
type Ism = NonNullable<Morph>["ism"];
type Verb = NonNullable<Morph>["verb"];

const hasMorphology = (ism: Ism, verb: Verb) =>
  Boolean(
    ism?.singular ||
      ism?.dual ||
      (ism?.plurals?.length ?? 0) > 0 ||
      verb?.past_tense ||
      verb?.present_tense ||
      verb?.imperative ||
      verb?.active_participle ||
      verb?.passive_participle ||
      (verb?.masadir?.length ?? 0) > 0
  );

const styles = StyleSheet.create({
  scroll: {
    width: "100%",
    maxHeight: 580,
  },
});
