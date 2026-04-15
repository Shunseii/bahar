import type { WordType } from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CircleCheck,
  MoreHorizontal,
  Play,
  Tag,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { DeckWithCounts } from "@/lib/db/operations/decks";
import { useThemeColors } from "@/lib/theme";

const WORD_TYPE_LABELS: Record<WordType, () => string> = {
  ism: () => t`Ism`,
  "fi'l": () => t`Fi'l`,
  harf: () => t`Harf`,
  expression: () => t`Expression`,
};

interface DeckCardProps {
  deck: DeckWithCounts;
  onStudy: () => void;
  onMenu: () => void;
}

export const DeckCard = ({ deck, onStudy, onMenu }: DeckCardProps) => {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const hasDueCards = deck.to_review > 0;
  const hasBacklog = deck.to_review_backlog > 0;
  const allCaughtUp = !hasDueCards && !hasBacklog;
  const hasFilters =
    (deck.filters?.tags && deck.filters.tags.length > 0) ||
    (deck.filters?.types && deck.filters.types.length > 0);

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
    >
      <Animated.View
        className="gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
        style={animatedStyle}
      >
        {/* Name + menu */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-semibold text-base text-foreground">
              {deck.name}
            </Text>
          </View>
          <Pressable hitSlop={8} onPress={onMenu}>
            <MoreHorizontal color={colors.mutedForeground} size={20} />
          </Pressable>
        </View>

        {/* Stats pills */}
        <View className="flex-row items-center gap-2">
          {hasDueCards && (
            <View className="flex-row items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1">
              <Text className="font-semibold text-primary text-xs">
                {deck.to_review} {t`due`}
              </Text>
            </View>
          )}
          {hasBacklog && (
            <View className="rounded-md bg-warning/10 px-2.5 py-1">
              <Text className="font-medium text-warning text-xs">
                {deck.to_review_backlog} {t`backlog`}
              </Text>
            </View>
          )}
          {allCaughtUp && (
            <View className="flex-row items-center gap-1 rounded-md px-2.5 py-1">
              <CircleCheck color={colors.primary} size={13} />
              <Text className="font-medium text-primary text-xs">
                <Trans>All caught up</Trans>
              </Text>
            </View>
          )}
          <View className="rounded-md px-2.5 py-1">
            <Text className="text-muted-foreground text-xs">
              {deck.total_hits} {t`total`}
            </Text>
          </View>
        </View>

        {/* Filter tags */}
        {hasFilters && (
          <View className="flex-row flex-wrap gap-1.5">
            {deck.filters?.tags?.map((tag) => (
              <View
                className="flex-row items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-0.5"
                key={tag}
              >
                <Tag color={colors.mutedForeground} size={11} />
                <Text className="text-muted-foreground text-xs">{tag}</Text>
              </View>
            ))}
            {deck.filters?.types && deck.filters.types.length > 0 && (
              <View className="flex-row items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-0.5">
                <Text className="text-muted-foreground text-xs">
                  {deck.filters.types
                    .map((type) => WORD_TYPE_LABELS[type]())
                    .join(", ")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Study button */}
        <View className="flex-row justify-end">
          <Pressable
            className={`flex-row items-center gap-1.5 rounded-full px-5 py-2 ${
              hasDueCards ? "bg-primary" : "border border-primary"
            }`}
            onPress={onStudy}
          >
            <Play
              color={hasDueCards ? colors.primaryForeground : colors.primary}
              size={14}
            />
            <Text
              className={`font-semibold text-sm ${
                hasDueCards ? "text-primary-foreground" : "text-primary"
              }`}
            >
              <Trans>Study</Trans>
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
};
