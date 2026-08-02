import { cn } from "@bahar/design-system";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Search, TagIcon, X } from "lucide-react-native";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useBulkDictionaryActions } from "@/hooks/useBulkDictionaryActions";
import { dictionaryEntriesTable } from "@/lib/db/operations";
import { useThemeColors } from "@/lib/theme";

export interface BulkTagsSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface BulkTagsSheetProps {
  ids: string[];
  onDone: () => void;
}

/**
 * Bulk tag editor. Add and remove share one sheet -- they're the same picker
 * over a different set of tags (all tags vs. only the ones the selection has),
 * so a segmented control switches mode instead of splitting them into two
 * separate entry points on the action bar.
 */
export const BulkTagsSheet = forwardRef<BulkTagsSheetRef, BulkTagsSheetProps>(
  ({ ids, onDone }, ref) => {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const [action, setAction] = useState<"add" | "remove">("add");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [filter, setFilter] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [inputKey, setInputKey] = useState(0);
    const { updateTags, isPending } = useBulkDictionaryActions();

    // The input is uncontrolled, so emptying the state doesn't empty the box:
    // remounting it is what clears the text. Only used where focus doesn't
    // matter -- opening the sheet and switching mode.
    const clearFilter = useCallback(() => {
      setFilter("");
      setInputKey((key) => key + 1);
    }, []);

    const reset = useCallback(() => {
      setAction("add");
      setSelectedTags([]);
      clearFilter();
    }, [clearFilter]);

    const handleDismiss = useCallback(() => {
      setIsOpen(false);
      reset();
    }, [reset]);

    useImperativeHandle(ref, () => ({
      present: () => {
        reset();
        setIsOpen(true);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const { data: tags } = useQuery({
      queryFn: () =>
        action === "add"
          ? dictionaryEntriesTable.tags.query()
          : dictionaryEntriesTable.tagsForEntries.query({ ids }),
      queryKey:
        action === "add"
          ? [...dictionaryEntriesTable.tags.cacheOptions.queryKey]
          : [
              ...dictionaryEntriesTable.tagsForEntries.cacheOptions.queryKey,
              ids,
            ],
      // Both sheets stay mounted with the action bar; querying while closed just
      // burns work on a list nobody is looking at.
      enabled: isOpen,
    });

    const trimmedFilter = filter.trim();

    const visibleTags = useMemo(() => {
      if (!tags) return [];
      if (!trimmedFilter) return tags;

      return tags.filter(({ tag }) =>
        tag.toLowerCase().includes(trimmedFilter.toLowerCase())
      );
    }, [tags, trimmedFilter]);

    const canCreateTag =
      action === "add" &&
      trimmedFilter.length > 0 &&
      !tags?.some(({ tag }) => tag === trimmedFilter) &&
      !selectedTags.includes(trimmedFilter);

    const toggleTag = (tag: string) => {
      setSelectedTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    };

    const handleModeChange = (next: string) => {
      setAction(next as "add" | "remove");
      // The two modes list different tags, so a pending pick from the other
      // mode would be meaningless here.
      setSelectedTags([]);
      clearFilter();
    };

    const handleSubmit = useCallback(async () => {
      try {
        const changed = await updateTags({ ids, tags: selectedTags, action });

        toast.success(
          action === "add"
            ? t`Tags added to ${changed} entries`
            : t`Tags removed from ${changed} entries`
        );
        sheetRef.current?.dismiss();
        onDone();
      } catch {
        toast.error(
          action === "add" ? t`Failed to add tags` : t`Failed to remove tags`
        );
      }
    }, [action, ids, onDone, selectedTags, updateTags]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      []
    );

    // Only the action itself is destructive-styled. Tinting the pills and
    // checkboxes red as well made picking which tags to remove look like an
    // error state rather than a choice.
    const isDestructive = action === "remove";

    // Pinned with BottomSheetFooter so the action stays reachable without
    // scrolling past the whole tag list.
    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props}>
          <View
            className="border-border border-t bg-card px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <Pressable
              className={cn(
                "h-12 flex-row items-center justify-center gap-2 rounded-xl",
                isDestructive ? "bg-destructive" : "bg-primary",
                (selectedTags.length === 0 || isPending) && "opacity-50"
              )}
              disabled={selectedTags.length === 0 || isPending}
              onPress={handleSubmit}
            >
              <Text
                className={cn(
                  "font-semibold",
                  isDestructive
                    ? "text-destructive-foreground"
                    : "text-primary-foreground"
                )}
              >
                {action === "add" ? (
                  <Plural
                    one="Add # tag"
                    other="Add # tags"
                    value={selectedTags.length}
                  />
                ) : (
                  <Plural
                    one="Remove # tag"
                    other="Remove # tags"
                    value={selectedTags.length}
                  />
                )}
              </Text>
            </Pressable>
          </View>
        </BottomSheetFooter>
      ),
      [
        action,
        handleSubmit,
        insets.bottom,
        isDestructive,
        isPending,
        selectedTags,
      ]
    );

    return (
      <BottomSheetModal
        // The keyboard would otherwise cover the tag list and the action: the
        // sheet grows with it instead, and returns to its snap point on blur.
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.card }}
        enableDynamicSizing={false}
        footerComponent={renderFooter}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        // "extend" takes the sheet to its tallest snap point when the keyboard
        // opens. "interactive" only lifts it within the current one, so with a
        // single snap point there was nowhere to go and the keyboard covered the
        // list.
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        onChange={(index) => setIsOpen(index >= 0)}
        onDismiss={handleDismiss}
        ref={sheetRef}
        // Opens at the first, can be dragged to the second.
        snapPoints={["70%", "90%"]}
        topInset={insets.top}
      >
        <BottomSheetScrollView
          // Clears the pinned footer so the last tag row isn't stuck behind it.
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        >
          <View className="gap-3 px-5">
            <View>
              <Text className="font-semibold text-foreground text-lg">
                <Trans>Tags</Trans>
              </Text>
              <Text className="text-muted-foreground text-sm">
                <Plural
                  one="# entry selected"
                  other="# entries selected"
                  value={ids.length}
                />
              </Text>
            </View>

            {/* Row wrapper so the track is only as wide as its two segments,
                rather than stretching across the sheet. */}
            <View className="flex-row">
              <SegmentedControl
                onValueChange={handleModeChange}
                options={[
                  { value: "add", label: t`Add` },
                  { value: "remove", label: t`Remove` },
                ]}
                value={action}
              />
            </View>

            {selectedTags.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Pressable
                    className="flex-row items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5"
                    key={tag}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text className="text-primary text-sm">{tag}</Text>
                    <X color={colors.primary} size={14} />
                  </Pressable>
                ))}
              </View>
            )}

            <View className="flex-row items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Search color={colors.mutedForeground} size={16} />
              <BottomSheetTextInput
                autoCapitalize="none"
                className="flex-1 py-2.5 text-foreground"
                key={inputKey}
                onChangeText={setFilter}
                placeholder={
                  action === "add"
                    ? t`Search or create a tag`
                    : t`Filter tags on these entries`
                }
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <Text className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {action === "add" ? (
                <Trans>Your tags</Trans>
              ) : (
                <Trans>Tags on selected entries</Trans>
              )}
            </Text>

            {canCreateTag && (
              <Pressable
                className="flex-row items-center gap-2 py-3"
                onPress={() => toggleTag(trimmedFilter)}
              >
                <TagIcon color={colors.primary} size={16} />
                <Text className="text-primary text-sm">
                  <Trans>Create</Trans>
                </Text>
                <Text className="font-medium text-foreground text-sm">
                  {trimmedFilter}
                </Text>
              </Pressable>
            )}

            {visibleTags.length === 0 && !canCreateTag && (
              <Text className="py-3 text-muted-foreground text-sm">
                {action === "add" ? (
                  <Trans>No tags yet. Type to create one.</Trans>
                ) : (
                  <Trans>The selected entries have no tags.</Trans>
                )}
              </Text>
            )}

            {visibleTags.map(({ tag, count }) => (
              <Pressable
                className="flex-row items-center gap-3 py-3"
                key={tag}
                onPress={() => toggleTag(tag)}
              >
                <Checkbox
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                />
                <Text className="flex-1 text-foreground">{tag}</Text>
                <Text className="text-muted-foreground text-xs">
                  {action === "add" ? (
                    <Plural one="# entry" other="# entries" value={count} />
                  ) : (
                    <Trans>
                      on {count} of {ids.length}
                    </Trans>
                  )}
                </Text>
              </Pressable>
            ))}
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

BulkTagsSheet.displayName = "BulkTagsSheet";
