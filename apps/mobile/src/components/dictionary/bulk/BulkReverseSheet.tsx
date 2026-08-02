import { cn } from "@bahar/design-system";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react-native";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { useBulkDictionaryActions } from "@/hooks/useBulkDictionaryActions";
import { flashcardsTable } from "@/lib/db/operations";
import { useThemeColors } from "@/lib/theme";

export interface BulkReverseSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface BulkReverseSheetProps {
  ids: string[];
  onDone: () => void;
}

/**
 * Bulk enable/disable of the reverse (English → Arabic) flashcard. Both options
 * spell out how many of the selected words they would actually change, since
 * reverse cards exist per word and a selection is usually mixed.
 */
export const BulkReverseSheet = forwardRef<
  BulkReverseSheetRef,
  BulkReverseSheetProps
>(({ ids, onDone }, ref) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [mode, setMode] = useState<"enable" | "disable">("enable");
  const { setReverse, isPending } = useBulkDictionaryActions();

  useImperativeHandle(ref, () => ({
    present: () => {
      setMode("enable");
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const { data: withReverse } = useQuery({
    queryFn: () =>
      flashcardsTable.reverseCountForEntries.query({
        dictionary_entry_ids: ids,
      }),
    queryKey: [
      ...flashcardsTable.reverseCountForEntries.cacheOptions.queryKey,
      ids,
    ],
  });

  const withoutReverse =
    withReverse === undefined ? undefined : ids.length - withReverse;

  const handleSubmit = async () => {
    try {
      const changed = await setReverse({ ids, enabled: mode === "enable" });

      toast.success(
        mode === "enable"
          ? t`Reverse cards enabled for ${changed} entries`
          : t`Reverse cards removed from ${changed} entries`
      );
      sheetRef.current?.dismiss();
      onDone();
    } catch {
      toast.error(t`Failed to update reverse cards`);
    }
  };

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

  const options = [
    {
      value: "enable" as const,
      label: t`Enable for all`,
      description:
        withoutReverse === undefined
          ? t`Creates a reverse card for the selected entries that don't have one.`
          : t`Creates a reverse card for the ${withoutReverse} selected entries that don't have one. Entries that already have one are untouched.`,
    },
    {
      value: "disable" as const,
      label: t`Disable for all`,
      description:
        withReverse === undefined
          ? t`Deletes the reverse card of the selected entries that have one, along with its review history.`
          : t`Deletes the reverse card of the ${withReverse} selected entries that have one, along with its review history.`,
    },
  ];

  return (
    <BottomSheetModal
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      enableDynamicSizing
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      ref={sheetRef}
      topInset={insets.top}
    >
      <BottomSheetView>
        <View
          className="gap-3 px-5"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View>
            <Text className="font-semibold text-foreground text-lg">
              <Trans>Reverse flashcards</Trans>
            </Text>
            <Text className="text-muted-foreground text-sm">
              <Plural
                one="# entry selected"
                other="# entries selected"
                value={ids.length}
              />
            </Text>
          </View>

          {options.map((option) => {
            const isActive = mode === option.value;

            return (
              <Pressable
                className={cn(
                  "gap-1.5 rounded-xl border p-4",
                  isActive ? "border-primary bg-primary/5" : "border-border"
                )}
                key={option.value}
                onPress={() => setMode(option.value)}
              >
                <View className="flex-row items-center gap-2.5">
                  <View
                    className={cn(
                      "h-5 w-5 items-center justify-center rounded-full border-2",
                      isActive ? "border-primary" : "border-border"
                    )}
                  >
                    {isActive && (
                      <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </View>
                  <Text className="font-semibold text-foreground">
                    {option.label}
                  </Text>
                </View>
                <Text className="pl-8 text-muted-foreground text-sm">
                  {option.description}
                </Text>
              </Pressable>
            );
          })}

          {mode === "disable" && (
            <View className="flex-row gap-2.5 rounded-lg bg-warning/10 p-3">
              <TriangleAlert color={colors.warning} size={16} />
              <Text className="flex-1 text-sm text-warning">
                <Trans>
                  Disabling deletes the reverse card and its review progress.
                  This can't be undone.
                </Trans>
              </Text>
            </View>
          )}

          <Pressable
            className={cn(
              "h-12 items-center justify-center rounded-xl",
              mode === "disable" ? "bg-destructive" : "bg-primary",
              isPending && "opacity-50"
            )}
            disabled={isPending}
            onPress={handleSubmit}
          >
            <Text
              className={cn(
                "font-semibold",
                mode === "disable"
                  ? "text-destructive-foreground"
                  : "text-primary-foreground"
              )}
            >
              <Plural
                one="Apply to # entry"
                other="Apply to # entries"
                value={ids.length}
              />
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

BulkReverseSheet.displayName = "BulkReverseSheet";
