/**
 * Grade feedback animation component.
 *
 * Shows animated feedback based on the grade selected.
 * Animations match the web implementation.
 */

import * as Haptics from "expo-haptics";
import { Brain, RotateCcw, ThumbsUp, Zap } from "lucide-react-native";
import type React from "react";
import { useEffect } from "react";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { type Grade, Rating } from "ts-fsrs";
import { useThemeColors } from "@/lib/theme";

interface GradeFeedbackProps {
  grade: Grade | null;
  onComplete: () => void;
}

const ICON_SIZE = 48;

const feedbackConfig: Record<
  Grade,
  {
    Icon: typeof RotateCcw;
    colorKey: "mutedForeground" | "warning" | "primary" | "success";
    bgColor: string;
  }
> = {
  1: {
    Icon: RotateCcw,
    colorKey: "mutedForeground",
    bgColor: "bg-muted/30",
  },
  2: {
    Icon: Brain,
    colorKey: "warning",
    bgColor: "bg-warning/20",
  },
  3: {
    Icon: ThumbsUp,
    colorKey: "primary",
    bgColor: "bg-primary/20",
  },
  4: {
    Icon: Zap,
    colorKey: "success",
    bgColor: "bg-success/20",
  },
};

export const GradeFeedback: React.FC<GradeFeedbackProps> = ({
  grade,
  onComplete,
}) => {
  const colors = useThemeColors();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);
  const translateY = useSharedValue(0);
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

    // Background pulse: fade in then out
    bgOpacity.value = withSequence(
      withTiming(0.5, { duration: 150 }),
      withTiming(0, { duration: 450 })
    );

    // Animate in
    opacity.value = withTiming(1, { duration: 100 });

    if (grade === Rating.Again) {
      // Scale up with shake — matches web: scale [0, 1.2, 1], rotate [0, -10, 10, -10, 0]
      translateY.value = 0;
      scale.value = withSequence(
        withTiming(1.2, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
      );
      rotation.value = withSequence(
        withTiming(-10, { duration: 100 }),
        withTiming(10, { duration: 100 }),
        withTiming(-10, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
    } else if (grade === Rating.Hard) {
      // Scale up — matches web: scale [0, 1.3, 1]
      translateY.value = 0;
      rotation.value = 0;
      scale.value = withSequence(
        withTiming(1.3, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
      );
    } else if (grade === Rating.Good) {
      // Spring up — matches web: spring with y translation
      rotation.value = 0;
      translateY.value = 10;
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
    } else if (grade === Rating.Easy) {
      // Scale + rotate — matches web: scale [0, 1.4, 1], rotate [-20, 10, 0]
      translateY.value = 0;
      rotation.value = -20;
      scale.value = withSequence(
        withTiming(1.4, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) })
      );
      rotation.value = withSequence(
        withTiming(10, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
      );
    }

    // Complete after animation
    const timer = setTimeout(() => {
      // Advance immediately and let the fade-out run in parallel, matching web
      // (which fires onComplete at 600ms). Gating the advance on the fade's
      // completion callback added ~150ms where the card just sat there.
      opacity.value = withTiming(0, { duration: 150 });
      runOnJS(onComplete)();
    }, 600);

    return () => clearTimeout(timer);
  }, [grade, opacity, scale, rotation, translateY, bgOpacity, onComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  if (grade === null) return null;

  const config = feedbackConfig[grade];
  const { Icon } = config;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        containerStyle,
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 50,
        },
      ]}
    >
      {/* Background pulse */}
      <Animated.View
        className={config.bgColor}
        style={[
          bgStyle,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
      />

      <Animated.View
        className={`rounded-full p-6 ${config.bgColor}`}
        style={iconContainerStyle}
      >
        <Icon color={colors[config.colorKey]} size={ICON_SIZE} />
      </Animated.View>

      {grade === Rating.Easy && <SparkleEffect color={colors.success} />}
    </Animated.View>
  );
};

const SparkleEffect: React.FC<{ color: string }> = ({ color }) => {
  const sparkles = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 6;
    return { angle, key: i };
  });

  return (
    <>
      {sparkles.map(({ angle, key }) => (
        <SparkleParticle angle={angle} color={color} key={key} />
      ))}
    </>
  );
};

const SparkleParticle: React.FC<{ angle: number; color: string }> = ({
  angle,
  color,
}) => {
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
      withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) })
    );
    scale.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 300 })
    );
    translateX.value = withTiming(x, {
      duration: 400,
      easing: Easing.out(Easing.ease),
    });
    translateY.value = withTiming(y, {
      duration: 400,
      easing: Easing.out(Easing.ease),
    });
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
      style={[
        style,
        {
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        },
      ]}
    />
  );
};
