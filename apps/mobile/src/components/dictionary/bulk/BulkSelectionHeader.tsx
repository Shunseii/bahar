import { Plural, Trans } from "@lingui/react/macro";
import { X } from "lucide-react-native";
import type { FC, MutableRefObject } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useBulkSelection } from "@/lib/store/selection";
import { useThemeColors } from "@/lib/theme";

interface BulkSelectionHeaderProps {
  /**
   * Resolver for every id matching the current search, owned by the list. Kept
   * as a ref so the header can ask for the full list on demand rather than
   * having thousands of ids pushed through props on every search.
   */
  allMatchingIdsRef: MutableRefObject<(() => string[]) | null>;
  /** How many words the current search matches, for the select-all label. */
  totalCount: number;
}

/**
 * Replaces the search header while a selection is active: how many words are
 * selected, a way to take every matching word, and a way out.
 */
export const BulkSelectionHeader: FC<BulkSelectionHeaderProps> = ({
  allMatchingIdsRef,
  totalCount,
}) => {
  const colors = useThemeColors();
  const { selectedCount, selectAll, clear, exitSelectionMode } =
    useBulkSelection();

  const allSelected = totalCount > 0 && selectedCount >= totalCount;

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
        <Text className="font-semibold text-base text-foreground">
          <Plural one="# selected" other="# selected" value={selectedCount} />
        </Text>
      </View>

      <Pressable
        hitSlop={8}
        onPress={() =>
          allSelected ? clear() : selectAll(allMatchingIdsRef.current?.() ?? [])
        }
      >
        <Text className="font-semibold text-primary text-sm">
          {allSelected ? (
            <Trans>Clear</Trans>
          ) : (
            <Plural
              one="Select all #"
              other="Select all #"
              value={totalCount}
            />
          )}
        </Text>
      </Pressable>
    </Animated.View>
  );
};
