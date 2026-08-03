import { cn } from "@bahar/design-system";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAtomValue } from "jotai";
import {
  BookOpen,
  GraduationCap,
  ListChecks,
  PlusIcon,
} from "lucide-react-native";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DictionaryList } from "@/components/dictionary";
import { BulkActionBar } from "@/components/dictionary/bulk/BulkActionBar";
import { DictionaryFilters } from "@/components/dictionary/DictionaryFilters";
import { Divider } from "@/components/flashcards/card";
import { GuestBanner } from "@/components/GuestBanner";
import { Button } from "@/components/ui/button";
import { useAppInit } from "@/hooks/useAppInit";
import { useBackToExit } from "@/hooks/useBackToExit";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { usePreloadDrawerScreens } from "@/hooks/usePreloadDrawerScreens";
import { useUserPlan } from "@/hooks/useUserPlan";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  flashcardsTable,
} from "@/lib/db/operations";
import {
  selectedTagsAtom,
  selectedTypesAtom,
  sortOptionAtom,
  tagModeAtom,
} from "@/lib/store/filters";
import { useBulkSelection } from "@/lib/store/selection";
import { useThemeColors } from "@/lib/theme";
import { useSearchQuery } from "../_layout";

/**
 * Space the floating bulk action bar needs at the bottom of the list: its
 * summary row, its action row, and the gap below it. Fixed, because the bar's
 * own height is fixed -- see the reserved secondary line in BulkActionBar. Also
 * what drag-select uses to keep its auto-scroll zone above the bar.
 */
const BULK_BAR_CLEARANCE = 124;

const formatElapsedTime = ({
  nanoseconds,
  format,
}: {
  nanoseconds: number;
  format: (n: number) => string;
}): string => {
  if (nanoseconds < 1000) {
    return `${format(Math.round(nanoseconds))}ns`;
  }
  if (nanoseconds < 1_000_000) {
    return `${format(Number((nanoseconds / 1000).toFixed(2)))}μs`;
  }
  if (nanoseconds < 1_000_000_000) {
    return `${format(Number((nanoseconds / 1_000_000).toFixed(2)))}ms`;
  }
  return `${format(Number((nanoseconds / 1_000_000_000).toFixed(2)))}s`;
};

const PulsingDot = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-warning"
      style={{ opacity }}
    />
  );
};

// Header component that scrolls with the list
const HeaderCard = ({
  totalResults,
  elapsedTimeNs,
  regularCount,
  backlogCount,
  isPending,
  onReviewPress,
  onAddPress,
  onSelectPress,
  isSelecting,
}: {
  totalResults: number | null;
  elapsedTimeNs: number | null;
  regularCount: number;
  backlogCount: number;
  isPending: boolean;
  onReviewPress: () => void;
  onAddPress: () => void;
  onSelectPress: () => void;
  isSelecting: boolean;
}) => {
  const colors = useThemeColors();
  const { formatNumber } = useFormatNumber();

  return (
    <View className="mt-1 mb-4 overflow-hidden rounded-xl border border-border/50 bg-card">
      <View className="px-4 pt-4 pb-3">
        <View className="mb-3 flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"
            style={{
              borderWidth: 1,
              borderColor: `${colors.primary}33`,
            }}
          >
            <BookOpen color={colors.primary} size={20} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-foreground text-lg tracking-tight">
              <Trans>Your Dictionary</Trans>
            </Text>
            <Text className="text-muted-foreground text-sm">
              {totalResults !== null ? (
                <>
                  <Plural
                    one={`${formatNumber(totalResults)} result`}
                    other={`${formatNumber(totalResults)} results`}
                    value={totalResults}
                  />
                  {elapsedTimeNs !== null && (
                    <Text className="text-muted-foreground/60">
                      {" · "}
                      {formatElapsedTime({
                        nanoseconds: elapsedTimeNs,
                        format: formatNumber,
                      })}
                    </Text>
                  )}
                </>
              ) : (
                <Trans>Loading...</Trans>
              )}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <Button Icon={PlusIcon} onPress={onAddPress} variant="outline">
            <Trans>Add word</Trans>
          </Button>

          <View className="relative">
            <Button
              disabled={isPending}
              onPress={onReviewPress}
              variant="outline"
            >
              <View className="flex-row items-center gap-1.5">
                <GraduationCap color={colors.mutedForeground} size={16} />
                <Text
                  className={`text-foreground text-sm ${isPending ? "opacity-50" : ""}`}
                >
                  <Trans>Review</Trans>
                </Text>

                {!isPending && regularCount > 0 && (
                  <View
                    className="ml-0.5 h-5 min-w-5 items-center justify-center rounded-full px-1.5"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text
                      className="font-semibold text-xs"
                      style={{ color: colors.primaryForeground }}
                    >
                      {formatNumber(regularCount)}
                    </Text>
                  </View>
                )}
              </View>
            </Button>
            {backlogCount > 0 && <PulsingDot />}
          </View>
        </View>
      </View>

      <Divider />

      <View className="flex-row justify-between px-4 py-2">
        <DictionaryFilters />

        <Pressable
          accessibilityLabel={
            isSelecting ? t`Exit selection mode` : t`Select entries`
          }
          accessibilityRole="button"
          accessibilityState={{ selected: isSelecting }}
          className={cn(
            "rounded-md border p-2 active:bg-primary/10",
            isSelecting ? "border-primary bg-primary/10" : "border-input"
          )}
          hitSlop={6}
          onPress={onSelectPress}
        >
          <ListChecks
            color={isSelecting ? colors.primary : colors.mutedForeground}
            size={16}
          />
        </Pressable>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { searchQuery } = useSearchQuery();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const selectedTags = useAtomValue(selectedTagsAtom);
  const selectedTypes = useAtomValue(selectedTypesAtom);
  const sortOption = useAtomValue(sortOptionAtom);
  const { selectionMode, enterSelectionMode, exitSelectionMode } =
    useBulkSelection();
  const tagMode = useAtomValue(tagModeAtom);
  const { isAnonymous } = useUserPlan();
  const { state, error } = useAppInit();

  usePreloadDrawerScreens(state === "ready");
  useBackToExit();
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [elapsedTimeNs, setElapsedTimeNs] = useState<number | null>(null);

  const { data: counts, isPending } = useQuery({
    queryFn: () =>
      flashcardsTable.counts.query({
        backlogThresholdDays: DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }),
    ...flashcardsTable.counts.cacheOptions,
    enabled: state === "ready",
    refetchOnMount: true,
    // Cards cross their due time purely by the clock advancing, with nothing to
    // invalidate the query. Poll while mounted so the due count updates on its
    // own -- react-query pauses this while the app is backgrounded.
    refetchInterval: 15_000,
  });

  const regularCount = counts?.regular ?? 0;
  const backlogCount = counts?.backlog ?? 0;

  const handleTotalCountChange = useCallback((count: number) => {
    setTotalResults(count);
  }, []);

  const handleElapsedTimeChange = useCallback((elapsed: number | null) => {
    setElapsedTimeNs(elapsed);
  }, []);

  const handleReviewPress = useCallback(() => {
    router.push({
      pathname: "/review",
      params: {
        regularCount: String(regularCount),
        backlogCount: String(backlogCount),
      },
    });
  }, [router, regularCount, backlogCount]);

  const handleAddPress = useCallback(() => {
    router.push("/(search)/(home)/add-word");
  }, [router]);

  const listHeader = useMemo(
    () => (
      <>
        {isAnonymous && <GuestBanner />}
        <HeaderCard
          backlogCount={backlogCount}
          elapsedTimeNs={elapsedTimeNs}
          isPending={isPending}
          isSelecting={selectionMode}
          onAddPress={handleAddPress}
          onReviewPress={handleReviewPress}
          onSelectPress={selectionMode ? exitSelectionMode : enterSelectionMode}
          regularCount={regularCount}
          totalResults={totalResults}
        />
      </>
    ),
    [
      isAnonymous,
      totalResults,
      elapsedTimeNs,
      regularCount,
      backlogCount,
      isPending,
      selectionMode,
      enterSelectionMode,
      exitSelectionMode,
    ]
  );

  if (state === "loading" || state === "idle") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="mt-4 text-muted-foreground">
          <Trans>Loading your dictionary...</Trans>
        </Text>
      </View>
    );
  }

  if (state === "error") {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="mb-2 font-medium text-destructive text-lg">
          <Trans>Something went wrong</Trans>
        </Text>
        <Text className="text-center text-muted-foreground">{error}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <DictionaryList
        bottomInset={
          selectionMode ? insets.bottom + BULK_BAR_CLEARANCE : insets.bottom
        }
        ListHeaderComponent={listHeader}
        onElapsedTimeChange={handleElapsedTimeChange}
        onTotalCountChange={handleTotalCountChange}
        searchQuery={deferredSearchQuery}
        sort={sortOption}
        tagMode={tagMode}
        tags={selectedTags}
        types={selectedTypes}
      />

      {selectionMode && <BulkActionBar bottomInset={insets.bottom} />}
    </View>
  );
}
