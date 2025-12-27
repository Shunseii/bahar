import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BookOpen, GraduationCap, PlusIcon } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DictionaryList } from "@/components/dictionary";
import { useAppInit } from "@/hooks/useAppInit";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { useThemeColors } from "@/lib/theme";
import { useSearchQuery } from "../_layout";

/**
 * Formats nanoseconds to a human-readable elapsed time string.
 */
const formatElapsedTime = (nanoseconds: number): string => {
  if (nanoseconds < 1000) {
    return `${nanoseconds.toFixed(0)}ns`;
  }
  if (nanoseconds < 1_000_000) {
    return `${(nanoseconds / 1000).toFixed(2)}μs`;
  }
  if (nanoseconds < 1_000_000_000) {
    return `${(nanoseconds / 1_000_000).toFixed(2)}ms`;
  }
  return `${(nanoseconds / 1_000_000_000).toFixed(2)}s`;
};

// Header component that scrolls with the list
const HeaderCard = ({
  totalResults,
  elapsedTimeNs,
  dueCount,
  isPending,
  onReviewPress,
  onAddPress,
}: {
  totalResults: number | null;
  elapsedTimeNs: number | null;
  dueCount: number;
  isPending: boolean;
  onReviewPress: () => void;
  onAddPress: () => void;
}) => {
  const colors = useThemeColors();

  return (
    <View
      className="mt-1 mb-4 overflow-hidden rounded-xl bg-card"
      style={{
        shadowColor: colors.foreground,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {/* Decorative top gradient line */}
      <View className="h-px bg-primary/20" />

      <View className="px-4 pt-4 pb-3">
        {/* Top row: Icon + Title + Count */}
        <View className="mb-3 flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10"
            style={{
              borderWidth: 1,
              borderColor: `${colors.primary}33`, // 20% opacity
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
                    one={`${totalResults} result`}
                    other={`${totalResults} results`}
                    value={totalResults}
                  />
                  {elapsedTimeNs !== null && (
                    <Text className="text-muted-foreground/60">
                      {" · "}
                      {formatElapsedTime(elapsedTimeNs)}
                    </Text>
                  )}
                </>
              ) : (
                <Trans>Loading...</Trans>
              )}
            </Text>
          </View>
        </View>

        {/* Bottom row: Action Buttons */}
        <View className="flex-row items-center gap-2">
          {/* Review Button */}
          <Pressable
            className={`h-9 flex-row items-center gap-1.5 rounded-lg px-3 ${
              dueCount > 0 ? "bg-warning/10" : "active:bg-primary/5"
            }`}
            disabled={isPending}
            onPress={onReviewPress}
          >
            <GraduationCap
              color={dueCount > 0 ? colors.warning : colors.mutedForeground}
              size={16}
            />
            <Text
              className={`text-sm ${
                dueCount > 0 ? "" : "text-muted-foreground"
              } ${isPending ? "opacity-50" : ""}`}
              style={dueCount > 0 ? { color: colors.warning } : undefined}
            >
              <Trans>Review</Trans>
            </Text>
            {!isPending && dueCount > 0 && (
              <View
                className="ml-0.5 h-5 min-w-5 items-center justify-center rounded-full px-1.5"
                style={{ backgroundColor: colors.warning }}
              >
                <Text
                  className="font-semibold text-xs"
                  style={{ color: colors.warningForeground }}
                >
                  {dueCount}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Spacer */}
          <View className="flex-1" />

          {/* Add Word Button */}
          <Pressable
            className="h-9 flex-row items-center gap-1.5 rounded-md bg-primary px-3 active:opacity-80"
            onPress={onAddPress}
            style={{
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <PlusIcon color={colors.primaryForeground} size={16} />
            <Text className="font-medium text-primary-foreground text-sm">
              <Trans>Add word</Trans>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { searchQuery } = useSearchQuery();
  const { state, error } = useAppInit();
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [elapsedTimeNs, setElapsedTimeNs] = useState<number | null>(null);

  const { data: dueCards, isPending } = useQuery({
    queryFn: () => flashcardsTable.today.query({}),
    queryKey: flashcardsTable.today.cacheOptions.queryKey,
    enabled: state === "ready",
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const dueCount = dueCards?.length ?? 0;

  const handleTotalCountChange = useCallback((count: number) => {
    setTotalResults(count);
  }, []);

  const handleElapsedTimeChange = useCallback((elapsed: number | null) => {
    setElapsedTimeNs(elapsed);
  }, []);

  const handleReviewPress = useCallback(() => {
    router.push("/review");
  }, [router]);

  const handleAddPress = useCallback(() => {
    router.push("/(search)/(home)/add-word");
  }, [router]);

  // Memoize header to prevent re-renders
  const listHeader = useMemo(
    () => (
      <HeaderCard
        dueCount={dueCount}
        elapsedTimeNs={elapsedTimeNs}
        isPending={isPending}
        onAddPress={handleAddPress}
        onReviewPress={handleReviewPress}
        totalResults={totalResults}
      />
    ),
    [totalResults, elapsedTimeNs, dueCount, isPending]
  );

  // Show loading state while initializing
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

  // Show error state
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
      {/* Dictionary list with header */}
      <DictionaryList
        bottomInset={insets.bottom}
        ListHeaderComponent={listHeader}
        onElapsedTimeChange={handleElapsedTimeChange}
        onTotalCountChange={handleTotalCountChange}
        searchQuery={searchQuery}
      />
    </View>
  );
}
