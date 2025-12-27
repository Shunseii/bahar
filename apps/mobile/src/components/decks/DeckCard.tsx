/**
 * Deck card component with animated interactions.
 */

import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import * as Haptics from "expo-haptics";
import { ChevronRight, Layers, Sparkles } from "lucide-react-native";
import type React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme";

interface DeckCardProps {
  deck: SelectDeck & { due_count: number; total_count: number };
  onPress: () => void;
  onLongPress?: () => void;
}

export const DeckCard: React.FC<DeckCardProps> = ({
  deck,
  onPress,
  onLongPress,
}) => {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleLongPress = () => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress();
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const hasDueCards = deck.due_count > 0;

  return (
    <Pressable
      onLongPress={handleLongPress}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        className="rounded-2xl border border-border/30 bg-card p-4 shadow-sm"
        style={animatedStyle}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center">
            {/* Icon */}
            <View
              className={`rounded-xl p-3 ${hasDueCards ? "bg-primary/10" : "bg-muted/50"}`}
            >
              <Layers
                color={hasDueCards ? colors.primary : colors.mutedForeground}
                size={24}
              />
            </View>

            {/* Info */}
            <View className="ml-3 flex-1">
              <Text className="font-semibold text-foreground text-lg">
                {deck.name}
              </Text>
              <View className="mt-1 flex-row items-center">
                {hasDueCards ? (
                  <>
                    <Sparkles color={colors.primary} size={14} />
                    <Text className="ml-1 font-medium text-primary">
                      {deck.due_count} due
                    </Text>
                    <Text className="ml-2 text-muted-foreground">
                      / {deck.total_count} total
                    </Text>
                  </>
                ) : (
                  <Text className="text-muted-foreground">
                    {deck.total_count} cards
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Arrow */}
          <ChevronRight color={colors.mutedForeground} size={20} />
        </View>

        {/* Filters preview */}
        {deck.filters && Object.keys(deck.filters).length > 0 && (
          <View className="mt-3 flex-row flex-wrap gap-1">
            {deck.filters.tags?.map((tag, i) => (
              <View className="rounded bg-secondary px-2 py-0.5" key={i}>
                <Text className="text-secondary-foreground text-xs">{tag}</Text>
              </View>
            ))}
            {deck.filters.types?.map((type, i) => (
              <View className="rounded bg-primary/10 px-2 py-0.5" key={i}>
                <Text className="text-primary text-xs">{type}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};
