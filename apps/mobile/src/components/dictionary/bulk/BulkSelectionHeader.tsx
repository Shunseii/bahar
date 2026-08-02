import { Plural, Trans } from "@lingui/react/macro";
import { X } from "lucide-react-native";
import type { FC } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useBulkSelection, useSelectionScope } from "@/lib/store/selection";
import { useThemeColors } from "@/lib/theme";

/**
 * Replaces the search header while a selection is active: how many words are
 * selected, how many of them the current search doesn't show, a way to take
 * every matching word, and a way out.
 */
export const BulkSelectionHeader: FC = () => {
  const colors = useThemeColors();
  const { selectedCount, selectAll, clear, exitSelectionMode } =
    useBulkSelection();
  const { matchingCount, outsideResultsCount, allSelected } =
    useSelectionScope();

  return (
    <Animated.View
      className="flex-row items-center justify-between border-border border-b bg-background px-4 py-3"
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(140)}
    >
      <View className="flex-row items-center gap-3">
        <Pressable hitSlop={8} onPress={exitSelectionMode}>
          <X color={colors.foreground} size={24} />
        </Pressable>

        <View>
          <Text className="font-semibold text-base text-foreground">
            <Plural one="# selected" other="# selected" value={selectedCount} />
          </Text>

          {outsideResultsCount > 0 && (
            <Text className="text-muted-foreground text-xs">
              <Plural
                one="# not in these results"
                other="# not in these results"
                value={outsideResultsCount}
              />
            </Text>
          )}
        </View>
      </View>

      <Pressable
        hitSlop={8}
        onPress={() => (allSelected ? clear() : selectAll())}
      >
        <Text className="font-semibold text-primary text-sm">
          {allSelected ? (
            <Trans>Clear</Trans>
          ) : (
            <Plural
              one="Select all #"
              other="Select all #"
              value={matchingCount}
            />
          )}
        </Text>
      </Pressable>
    </Animated.View>
  );
};
