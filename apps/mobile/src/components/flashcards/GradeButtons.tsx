/**
 * Grade buttons component for flashcard review.
 *
 * Shows Again, Hard, Good, Easy buttons with interval previews.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Rating, type RecordLog, type Grade } from "@bahar/fsrs";
import { RotateCcw, Brain, ThumbsUp, Zap } from "lucide-react-native";
import { formatDistanceToNow } from "date-fns";
import * as Haptics from "expo-haptics";
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
          key={config.grade}
          config={config}
          interval={schedulingCards[config.grade].card.due}
          onPress={() => onGrade(config.grade)}
          disabled={disabled}
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
  const intervalText = formatDistanceToNow(interval);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      className="flex-1"
    >
      <Animated.View
        style={animatedStyle}
        className={`border-2 ${borderColor} rounded-xl py-3 items-center bg-card`}
      >
        <Icon size={20} color={color} />
        <Text
          style={{ color }}
          className="font-medium mt-1"
        >
          {label}
        </Text>
        <Text className="text-muted-foreground text-xs mt-0.5">
          {intervalText}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

interface ShowAnswerButtonProps {
  onPress: () => void;
}

export const ShowAnswerButton: React.FC<ShowAnswerButtonProps> = ({ onPress }) => {
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
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      className="px-4"
    >
      <Animated.View
        style={animatedStyle}
        className="bg-primary py-4 rounded-xl items-center shadow-lg"
      >
        <Text className="text-primary-foreground font-semibold text-lg">
          Show Answer
        </Text>
      </Animated.View>
    </Pressable>
  );
};
