import { plural, t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Repeat, TagIcon, Trash2, X } from "lucide-react-native";
import { type FC, useRef } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { toast } from "sonner-native";
import { useBulkDictionaryActions } from "@/hooks/useBulkDictionaryActions";
import { dictionaryEntriesTable } from "@/lib/db/operations";
import { useBulkSelection, useSelectionScope } from "@/lib/store/selection";
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
  const { selectedIds, selectedCount, selectAll, clear, exitSelectionMode } =
    useBulkSelection();
  const { matchingCount, outsideResultsCount, allSelected } =
    useSelectionScope();
  const { deleteEntries, isPending } = useBulkDictionaryActions();

  const ids = [...selectedIds];

  // One place decides what goes under the count, so the block above it stays a
  // single fixed-height slot.
  const secondaryLine =
    outsideResultsCount > 0
      ? plural(outsideResultsCount, {
          one: "# not in these results",
          other: "# not in these results",
        })
      : selectedCount === 0
        ? t`Tap entries to select them`
        : null;
  const disabled = selectedCount === 0 || isPending;

  const { data: dictionaryTotal } = useQuery({
    queryFn: () => dictionaryEntriesTable.count.query(),
    queryKey: [...dictionaryEntriesTable.count.cacheOptions.queryKey],
  });

  const isEverything =
    dictionaryTotal !== undefined &&
    dictionaryTotal > 0 &&
    ids.length >= dictionaryTotal;

  const runDelete = async () => {
    try {
      const deletedIds = await deleteEntries(ids);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(
        plural(deletedIds.length, {
          one: "# entry deleted",
          other: "# entries deleted",
        })
      );
      exitSelectionMode();
    } catch {
      toast.error(t`Failed to delete entries`);
    }
  };

  // Deleting a selection is one thing; deleting the whole dictionary is another,
  // and "select all" makes them a tap apart. That one asks twice.
  const confirmDeletingEverything = () => {
    Alert.alert(
      t`Delete your entire dictionary?`,
      t`This is every entry you have. All of them, their flashcards, and all review history will be permanently deleted, on this device and every device you sync with. This can't be undone.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete everything`,
          style: "destructive",
          onPress: runDelete,
        },
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      plural(selectedCount, {
        one: "Delete # entry?",
        other: "Delete # entries?",
      }),
      t`This removes the entries along with their flashcards and review history. This can't be undone.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          // Presenting an alert from inside another alert's handler is
          // dropped on iOS, so let the first one finish closing first.
          onPress: isEverything
            ? () => setTimeout(confirmDeletingEverything, 0)
            : runDelete,
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
          className="overflow-hidden rounded-2xl border border-border bg-card"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          {/* The count, select-all and exit live here rather than in the app
              header: the header keeps its search field, so a selection can be
              built across several searches -- which is the whole reason it
              survives a query change. */}
          <View className="flex-row items-center gap-3 border-border/60 border-b px-3 py-2">
            <Pressable
              accessibilityLabel={t`Exit selection mode`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={exitSelectionMode}
            >
              <X color={colors.foreground} size={20} />
            </Pressable>

            {/* Fixed height, contents centred: the count on its own sits in the
                middle, and with a second line the two stack. Either way the
                block -- and so the bar -- keeps the same height, which matters
                because the bar is anchored to the bottom and grows upward, so
                any change moves it under the user's thumb. */}
            <View className="h-9 flex-1 justify-center">
              <Text className="font-semibold text-foreground text-sm">
                <Plural
                  one="# selected"
                  other="# selected"
                  value={selectedCount}
                />
              </Text>

              {secondaryLine && (
                <Text
                  className="text-muted-foreground text-xs"
                  numberOfLines={1}
                >
                  {secondaryLine}
                </Text>
              )}
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

          <View className="flex-row items-center px-1.5">
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
        </View>
      </Animated.View>

      <BulkTagsSheet ids={ids} onDone={clear} ref={tagsSheetRef} />
      <BulkReverseSheet ids={ids} onDone={clear} ref={reverseSheetRef} />
    </>
  );
};
