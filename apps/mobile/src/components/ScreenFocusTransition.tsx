import { useIsFocused } from "@react-navigation/native";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const DURATION_MS = 180;
const TRANSLATE_PX = 8;

/**
 * Plays a short fade + upward slide whenever the wrapped screen gains focus.
 *
 * Drawer screens stay mounted (see detachInactiveScreens in the drawer layout),
 * so a mount-based entrance animation never fires when switching between them.
 * Keying off focus instead gives each screen its own transition, independent of
 * the drawer's close-slide, so a newly-shown screen eases in rather than popping.
 */
export const ScreenFocusTransition = ({ children }: PropsWithChildren) => {
  const isFocused = useIsFocused();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(TRANSLATE_PX);

  useEffect(() => {
    if (isFocused) {
      const config = { duration: DURATION_MS, easing: Easing.out(Easing.ease) };
      opacity.value = withTiming(1, config);
      translateY.value = withTiming(0, config);
    } else {
      // Reset instantly while blurred (not visible) so the next focus eases in.
      opacity.value = 0;
      translateY.value = TRANSLATE_PX;
    }
  }, [isFocused, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.fill, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
