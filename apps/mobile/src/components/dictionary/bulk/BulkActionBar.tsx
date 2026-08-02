import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import * as Haptics from "expo-haptics";
import { Repeat, TagIcon, Trash2 } from "lucide-react-native";
import { type FC, useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { toast } from "sonner-native";
import { useBulkDictionaryActions } from "@/hooks/useBulkDictionaryActions";
import { useBulkSelection } from "@/lib/store/selection";
import { useThemeColors } from "@/lib/theme";
import { BulkReverseSheet, type BulkReverseSheetRef } from "./BulkReverseSheet";
import { BulkTagsSheet, type BulkTagsSheetRef } from "./BulkTagsSheet";

interface BulkActionBarProps {
  bottomInset?: number;
}

/**
 * Floating action bar for the current selection. Tags (add and remove) live
 * behind one entry point so three thumb-sized targets fit comfortably; delete
 * confirms through the platform alert, matching the single-word delete on the
 * edit screen.
 */
export const BulkActionBar: FC<BulkActionBarProps> = ({ bottomInset = 0 }) => {
  const colors = useThemeColors();
  const tagsSheetRef = useRef<BulkTagsSheetRef>(null);
  const reverseSheetRef = useRef<BulkReverseSheetRef>(null);
  const { selectedIds, selectedCount, clear, exitSelectionMode } =
    useBulkSelection();
  const { deleteEntries, isPending } = useBulkDictionaryActions();

  const ids = [...selectedIds];
  const disabled = selectedCount === 0 || isPending;

  const confirmDelete = () => {
    Alert.alert(
      t`Delete ${selectedCount} words?`,
      t`This removes the words along with their flashcards and review history. This can't be undone.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: async () => {
            try {
              const deletedIds = await deleteEntries(ids);

              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              toast.success(t`${deletedIds.length} words deleted`);
              exitSelectionMode();
            } catch {
              toast.error(t`Failed to delete words`);
            }
          },
        },
      ]
    );
  };

  const actions = [
    {
      key: "tags",
      label: t`Tags`,
      icon: TagIcon,
      color: colors.foreground,
      onPress: () => tagsSheetRef.current?.present(),
    },
    {
      key: "reverse",
      label: t`Reverse`,
      icon: Repeat,
      color: colors.foreground,
      onPress: () => reverseSheetRef.current?.present(),
    },
    {
      key: "delete",
      label: t`Delete`,
      icon: Trash2,
      color: colors.destructive,
      onPress: confirmDelete,
    },
  ];

  return (
    <>
      <Animated.View
        className="absolute right-4 left-4"
        entering={FadeInDown.duration(200)}
        exiting={FadeOutDown.duration(150)}
        style={{ bottom: bottomInset + 12 }}
      >
        <View
          className="flex-row items-center rounded-2xl border border-border bg-card px-1.5"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          {actions.map(({ key, label, icon: Icon, color, onPress }) => (
            <Pressable
              className="flex-1 items-center gap-1 py-2.5"
              disabled={disabled}
              key={key}
              onPress={onPress}
              style={{ opacity: disabled ? 0.4 : 1 }}
            >
              <Icon color={color} size={20} />
              <Text className="font-medium text-xs" style={{ color }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {selectedCount === 0 && (
          <Text className="mt-2 text-center text-muted-foreground text-xs">
            <Trans>Tap words to select them</Trans>
          </Text>
        )}
      </Animated.View>

      <BulkTagsSheet ids={ids} onDone={clear} ref={tagsSheetRef} />
      <BulkReverseSheet ids={ids} onDone={clear} ref={reverseSheetRef} />
    </>
  );
};
