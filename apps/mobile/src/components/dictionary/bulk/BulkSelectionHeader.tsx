import { Plural, Trans } from "@lingui/react/macro";
import { X } from "lucide-react-native";
import type { FC } from "react";
import { Pressable, Text, View } from "react-native";
import { useBulkSelection } from "@/lib/store/selection";
import { useThemeColors } from "@/lib/theme";

interface BulkSelectionHeaderProps {
  /** Ids currently loaded in the list, which is what "select all" covers. */
  loadedIds: string[];
}

/**
 * Replaces the search header while a selection is active: how many words are
 * selected, a way to take everything loaded, and a way out.
 */
export const BulkSelectionHeader: FC<BulkSelectionHeaderProps> = ({
  loadedIds,
}) => {
  const colors = useThemeColors();
  const { selectedCount, selectedIds, selectAll, clear, exitSelectionMode } =
    useBulkSelection();

  const allLoadedSelected =
    loadedIds.length > 0 && loadedIds.every((id) => selectedIds.has(id));

  return (
    <View className="flex-row items-center justify-between border-border border-b bg-background px-4 py-3">
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
        onPress={() => (allLoadedSelected ? clear() : selectAll(loadedIds))}
      >
        <Text className="font-semibold text-primary text-sm">
          {allLoadedSelected ? <Trans>Clear</Trans> : <Trans>Select all</Trans>}
        </Text>
      </Pressable>
    </View>
  );
};
