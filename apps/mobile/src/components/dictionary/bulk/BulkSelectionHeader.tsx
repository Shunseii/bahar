import { Plural, Trans } from "@lingui/react/macro";
import { X } from "lucide-react-native";
import type { FC } from "react";
import { Pressable, Text, View } from "react-native";
import { useBulkSelection, useSelectionScope } from "@/lib/store/selection";
import { useThemeColors } from "@/lib/theme";

/**
 * Selection controls for the app header's row: how many entries are selected,
 * how many of them the current search doesn't show, a way to take every matching
 * entry, and a way out.
 *
 * Rendered inside the existing header row rather than as a bar of its own, so
 * entering selection mode swaps the row's contents instead of adding a second
 * header that pushes the whole list down.
 *
 * The selection count is read here, not in the header, on purpose: the drawer
 * keeps every screen live, so subscribing to it further up would re-render all
 * of them on every tap.
 */
export const BulkSelectionHeader: FC = () => {
  const colors = useThemeColors();
  const { selectedCount, selectAll, clear, exitSelectionMode } =
    useBulkSelection();
  const { matchingCount, outsideResultsCount, allSelected } =
    useSelectionScope();

  return (
    <View className="flex-1 flex-row items-center justify-between">
      <View className="flex-1 flex-row items-center gap-3">
        <Pressable
          className="-ml-2 p-2"
          hitSlop={8}
          onPress={exitSelectionMode}
        >
          <X color={colors.foreground} size={24} />
        </Pressable>

        <View className="flex-1">
          <Text className="font-semibold text-base text-foreground">
            <Plural one="# selected" other="# selected" value={selectedCount} />
          </Text>

          {outsideResultsCount > 0 && (
            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
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
    </View>
  );
};
