/**
 * Grade feedback animation component.
 *
 * Shows animated feedback based on the grade selected.
 */

import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { Rating, type Grade } from "@bahar/fsrs";
import { RotateCcw, Brain, ThumbsUp, Zap } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/lib/theme";

interface GradeFeedbackProps {
  grade: Grade | null;
  onComplete: () => void;
}

const ICON_SIZE = 48;

type ThemeColors = ReturnType<typeof useThemeColors>;

const getFeedbackConfig = (colors: ThemeColors): Record<Grade, { Icon: typeof RotateCcw; color: string; bgColor: string }> => ({
  1: { // Again
    Icon: RotateCcw,
    color: colors.mutedForeground,
    bgColor: "bg-muted/30",
  },
  2: { // Hard
    Icon: Brain,
    color: colors.warning,
    bgColor: "bg-warning/20",
  },
  3: { // Good
    Icon: ThumbsUp,
    color: colors.primary,
    bgColor: "bg-primary/20",
  },
  4: { // Easy
    Icon: Zap,
    color: colors.success,
    bgColor: "bg-success/20",
  },
});

export const GradeFeedback: React.FC<GradeFeedbackProps> = ({
  grade,
  onComplete,
}) => {
  const colors = useThemeColors();
  const feedbackConfig = getFeedbackConfig(colors);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    if (grade === null) return;

    // Trigger haptic based on grade
    if (grade === Rating.Easy) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (grade === Rating.Again) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Animate in
    opacity.value = withTiming(1, { duration: 100 });
    bgOpacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 400 }),
    );

    // Scale and rotation based on grade
    if (grade === Rating.Again) {
      rotation.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 100 }),
        withTiming(-10, { duration: 100 }),
        withTiming(0, { duration: 50 }),
      );
      scale.value = withSequence(
        withSpring(1.2, { damping: 10, stiffness: 300 }),
        withTiming(1, { duration: 200 }),
      );
    } else if (grade === Rating.Easy) {
      rotation.value = withSequence(
        withTiming(-15, { duration: 100 }),
        withSpring(0, { damping: 8, stiffness: 200 }),
      );
      scale.value = withSequence(
        withSpring(1.4, { damping: 8, stiffness: 300 }),
        withTiming(1, { duration: 200 }),
      );
    } else {
      scale.value = withSequence(
        withSpring(1.3, { damping: 10, stiffness: 300 }),
        withTiming(1, { duration: 200 }),
      );
    }

    // Complete after animation
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(onComplete)();
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [grade, opacity, scale, rotation, bgOpacity, onComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value * 0.5,
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  if (grade === null) return null;

  const config = feedbackConfig[grade];
  const { Icon } = config;

  return (
    <Animated.View
      style={[containerStyle, {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
      }]}
      pointerEvents="none"
    >
      {/* Background pulse */}
      <Animated.View
        style={[bgStyle, {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }]}
        className={config.bgColor}
      />

      {/* Icon */}
      <Animated.View
        style={iconContainerStyle}
        className={`p-6 rounded-full ${config.bgColor}`}
      >
        <Icon size={ICON_SIZE} color={config.color} />
      </Animated.View>

      {/* Sparkles for Easy grade */}
      {grade === Rating.Easy && <Sparkles color={colors.success} />}
    </Animated.View>
  );
};

const Sparkles: React.FC<{ color: string }> = ({ color }) => {
  const sparkles = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 6;
    return { angle, key: i };
  });

  return (
    <>
      {sparkles.map(({ angle, key }) => (
        <SparkleParticle key={key} angle={angle} color={color} />
      ))}
    </>
  );
};

const SparkleParticle: React.FC<{ angle: number; color: string }> = ({ angle, color }) => {
  const scale = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const distance = 80;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) }),
    );
    scale.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 300 }),
    );
    translateX.value = withTiming(x, { duration: 400, easing: Easing.out(Easing.ease) });
    translateY.value = withTiming(y, { duration: 400, easing: Easing.out(Easing.ease) });
  }, [angle, scale, translateX, translateY, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[style, {
        position: "absolute",
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
      }]}
    />
  );
};
