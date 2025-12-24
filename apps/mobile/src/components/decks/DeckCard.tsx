/**
 * Deck card component with animated interactions.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Layers, ChevronRight, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/lib/theme";
import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";

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
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <Animated.View
        style={animatedStyle}
        className="bg-card rounded-2xl p-4 border border-border/30 shadow-sm"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            {/* Icon */}
            <View
              className={`p-3 rounded-xl ${hasDueCards ? "bg-primary/10" : "bg-muted/50"}`}
            >
              <Layers size={24} color={hasDueCards ? colors.primary : colors.mutedForeground} />
            </View>

            {/* Info */}
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold text-lg">
                {deck.name}
              </Text>
              <View className="flex-row items-center mt-1">
                {hasDueCards ? (
                  <>
                    <Sparkles size={14} color={colors.primary} />
                    <Text className="text-primary ml-1 font-medium">
                      {deck.due_count} due
                    </Text>
                    <Text className="text-muted-foreground ml-2">
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
          <ChevronRight size={20} color={colors.mutedForeground} />
        </View>

        {/* Filters preview */}
        {deck.filters && Object.keys(deck.filters).length > 0 && (
          <View className="mt-3 flex-row flex-wrap gap-1">
            {deck.filters.tags?.map((tag, i) => (
              <View key={i} className="bg-secondary px-2 py-0.5 rounded">
                <Text className="text-secondary-foreground text-xs">{tag}</Text>
              </View>
            ))}
            {deck.filters.types?.map((type, i) => (
              <View key={i} className="bg-primary/10 px-2 py-0.5 rounded">
                <Text className="text-primary text-xs">{type}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};
