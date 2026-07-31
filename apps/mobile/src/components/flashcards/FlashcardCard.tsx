/**
 * Flashcard card component with reveal animation, swipe-to-grade, and
 * scrollable answer side that surfaces the full morphology data model.
 */

import type { CardFieldId, CardLayout } from "@bahar/drizzle-user-db-schemas";
import { REQUIRED_FIELD_BY_FACE } from "@bahar/drizzle-user-db-schemas";
import { Trans } from "@lingui/react/macro";
import * as Sentry from "@sentry/react-native";
import * as Haptics from "expo-haptics";
import * as Updates from "expo-updates";
import { ChevronDown } from "lucide-react-native";
import type React from "react";
import { useCallback, useEffect } from "react";
import {
  Dimensions,
  I18nManager,
  type LayoutChangeEvent,
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
import { useCardFace } from "@/hooks/useCardFace";
import type { FlashcardWithDictionaryEntry } from "../../lib/db/operations";
import { CardFields, TagsRow } from "./card/CardFields";

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
  /** Set by the settings preview to render an unsaved layout draft. */
  layoutOverride?: CardLayout | null;
}

export const FlashcardCard: React.FC<FlashcardCardProps> = ({
  flashcard,
  showAnswer,
  onFlip,
  onSwipeLeft,
  onSwipeRight,
  layoutOverride,
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

  const direction = isReverse ? "reverse" : "forward";
  const questionFace = `${direction}_question` as const;
  const answerFace = `${direction}_answer` as const;
  const questionFields = useCardFace(questionFace, layoutOverride);
  const answerFields = useCardFace(answerFace, layoutOverride);

  // Q-side gesture: just tap (swipe disabled until answer shown)
  // A-side gesture: pan composes with native scroll via offset thresholds
  const composedGesture = showAnswer
    ? Gesture.Simultaneous(panGesture, tapGesture)
    : tapGesture;

  return (
    <GestureDetector gesture={composedGesture}>
      {/* w-full makes the card's width definite, taken from the card area
          (which gets its width from the screen). Without it the card is sized by
          whatever its widest content happens to be, so every percentage width
          inside it resolves against an indefinite parent -- which in Yoga means
          it does not resolve at all. Wrapping text then gets measured at an
          unconstrained width, reports one line, and has its height committed too
          short. It also made card width vary wildly between cards: one word's
          translation fit 233pt on a single line while another wrapped at ~124pt.

          shrink bounds the card's height instead of a measured pixel value. RN
          defaults flexShrink to 0 (web defaults to 1), so without it the card
          keeps its full content height and overflows the card area. */}
      <Animated.View
        className="w-full shrink overflow-hidden rounded-3xl border border-border/50 bg-card shadow-xl"
        onLayout={(event) => logCardLayout({ event, node: "card" })}
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

        {/* One scroll container for both sides rather than a scrollable answer
            and an unbounded question. Its height comes from the shrinking flex
            chain above, so whichever side overflows becomes scrollable on its
            own -- no measured ceiling to keep in sync with the device, the
            orientation or the OS font scale. */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          style={styles.scroll}
        >
          {showAnswer ? (
            <AnswerContent
              entry={entry}
              fields={answerFields}
              promptField={REQUIRED_FIELD_BY_FACE[answerFace]}
            />
          ) : (
            <QuestionContent
              entry={entry}
              fields={questionFields}
              isReverse={isReverse}
              promptField={REQUIRED_FIELD_BY_FACE[questionFace]}
            />
          )}
        </ScrollView>
      </Animated.View>
    </GestureDetector>
  );
};

interface QuestionContentProps {
  entry: FlashcardWithDictionaryEntry["dictionary_entry"];
  fields: CardFieldId[];
  isReverse: boolean;
  promptField: CardFieldId;
}

const QuestionContent: React.FC<QuestionContentProps> = ({
  entry,
  fields,
  isReverse,
  promptField,
}) => {
  // Tags stay pinned to the top of the question side, above the centred prompt,
  // so the reveal hint keeps its place at the bottom of the card.
  const showsTags = fields.includes("tags");
  const centredFields = fields.filter((field) => field !== "tags");

  return (
    <View className="min-h-[320px] justify-between gap-6 p-6">
      {showsTags ? <TagsRow tags={entry.tags ?? []} /> : <View />}
      <View className="w-full flex-1 items-center justify-center gap-4">
        <CardFields
          entry={entry}
          fields={centredFields}
          promptField={promptField}
        />
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
};

/**
 * TEMPORARY DIAGNOSTIC: the resolved width at each level of the chain.
 *
 * A single width was not enough to reason about: one card's translation fit
 * 233pt on one line while another wrapped at around 124pt, and there was no way
 * to tell which node was responsible. Logging card, content and box separately
 * shows where the width actually comes from, and whether they now agree.
 *
 * `buildId` matters because this ships over OTA, where an update applies on the
 * second cold launch by default -- without it a stale bundle is indistinguishable
 * from a fix that did not work.
 */
const logCardLayout = ({
  event,
  node,
}: {
  event: LayoutChangeEvent;
  node: "card" | "answerContent" | "translationBox";
}) => {
  const { width, height } = event.nativeEvent.layout;

  Sentry.logger.info("flashcard.answer.layout", {
    operation: "flashcard.translationTruncation",
    node,
    width: Math.round(width),
    height: Math.round(height),
    buildId: Updates.updateId ?? "embedded",
    runtimeVersion: Updates.runtimeVersion ?? "unknown",
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  });
};

interface AnswerContentProps {
  entry: FlashcardWithDictionaryEntry["dictionary_entry"];
  fields: CardFieldId[];
  promptField: CardFieldId;
}

const AnswerContent: React.FC<AnswerContentProps> = ({
  entry,
  fields,
  promptField,
}) => (
  <Animated.View
    className="w-full items-center gap-3.5 px-5 py-5"
    entering={FadeIn.duration(200)}
    onLayout={(event) => logCardLayout({ event, node: "answerContent" })}
  >
    {/* w-full is load-bearing, not cosmetic. The parent centers its children
        (items-center), so without an explicit width this box is content-sized:
        its height gets measured from the text at its *unconstrained* width,
        which never wraps and so reports a single line. The box then lays out at
        the card's narrower width, the text wraps to two lines, and the height is
        already committed one line short -- the overflow is clipped by the card's
        overflow-hidden, silently dropping part of the translation. A definite
        width means the measure and layout passes agree. */}
    <View
      className="w-full items-center gap-3.5"
      onLayout={(event) => logCardLayout({ event, node: "translationBox" })}
    >
      <CardFields entry={entry} fields={fields} promptField={promptField} />
    </View>
  </Animated.View>
);

const styles = StyleSheet.create({
  scroll: {
    width: "100%",
    flexShrink: 1,
  },
  // Lets the question side keep filling the card (its min height plus
  // justify-between spacing) while still allowing the content to grow taller
  // than the scroll view and scroll.
  scrollContent: {
    flexGrow: 1,
  },
});
