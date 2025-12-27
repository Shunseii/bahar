/**
 * Grade buttons component for flashcard review.
 *
 * Shows Again, Hard, Good, Easy buttons with interval previews.
 */

import { type Grade, Rating, type RecordLog } from "@bahar/fsrs";
import { intlFormatDistance } from "date-fns";
import * as Haptics from "expo-haptics";
import { Brain, RotateCcw, ThumbsUp, Zap } from "lucide-react-native";
import type React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme";

interface GradeButtonsProps {
  schedulingCards: RecordLog;
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

type ThemeColors = ReturnType<typeof useThemeColors>;

const getGradeConfig = (colors: ThemeColors) => [
  {
    grade: Rating.Again as Grade,
    Icon: RotateCcw,
    label: "Again",
    color: colors.mutedForeground,
    borderColor: "border-muted-foreground/30",
    pressedBg: "bg-muted/50",
  },
  {
    grade: Rating.Hard as Grade,
    Icon: Brain,
    label: "Hard",
    color: colors.warning,
    borderColor: "border-warning/30",
    pressedBg: "bg-warning/10",
  },
  {
    grade: Rating.Good as Grade,
    Icon: ThumbsUp,
    label: "Good",
    color: colors.primary,
    borderColor: "border-primary/30",
    pressedBg: "bg-primary/10",
  },
  {
    grade: Rating.Easy as Grade,
    Icon: Zap,
    label: "Easy",
    color: colors.success,
    borderColor: "border-success/30",
    pressedBg: "bg-success/10",
  },
];

export const GradeButtons: React.FC<GradeButtonsProps> = ({
  schedulingCards,
  onGrade,
  disabled = false,
}) => {
  const colors = useThemeColors();
  const gradeConfig = getGradeConfig(colors);

  return (
    <View className="flex-row gap-2 px-4">
      {gradeConfig.map((config) => (
        <GradeButton
          config={config}
          disabled={disabled}
          interval={schedulingCards[config.grade].card.due}
          key={config.grade}
          onPress={() => onGrade(config.grade)}
        />
      ))}
    </View>
  );
};

interface GradeButtonProps {
  config: ReturnType<typeof getGradeConfig>[0];
  interval: Date;
  onPress: () => void;
  disabled: boolean;
}

const GradeButton: React.FC<GradeButtonProps> = ({
  config,
  interval,
  onPress,
  disabled,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    opacity.value = withSpring(0.8, { damping: 15, stiffness: 400 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : opacity.value,
  }));

  const { Icon, label, color, borderColor } = config;
  const intervalText = intlFormatDistance(interval, new Date(), {
    style: "narrow",
  });

  return (
    <Pressable
      className="flex-1"
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        className={`border-2 ${borderColor} items-center rounded-xl bg-card py-3`}
        style={animatedStyle}
      >
        <Icon color={color} size={20} />
        <Text className="mt-1 font-medium" style={{ color }}>
          {label}
        </Text>
        <Text className="mt-0.5 text-muted-foreground text-xs">
          {intervalText}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

interface ShowAnswerButtonProps {
  onPress: () => void;
}

export const ShowAnswerButton: React.FC<ShowAnswerButtonProps> = ({
  onPress,
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      className="px-4"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        className="items-center rounded-xl bg-primary py-4 shadow-lg"
        style={animatedStyle}
      >
        <Text className="font-semibold text-lg text-primary-foreground">
          Show Answer
        </Text>
      </Animated.View>
    </Pressable>
  );
};
