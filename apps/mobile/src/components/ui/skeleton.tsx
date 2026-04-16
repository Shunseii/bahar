import { cn } from "@bahar/design-system";
import { useEffect } from "react";
import type { ViewProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface SkeletonProps extends ViewProps {
  className?: string;
}

export const Skeleton = ({ className, ...props }: SkeletonProps) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={cn("rounded-md bg-muted", className)}
      style={animatedStyle}
      {...props}
    />
  );
};
