import React, { useState, useCallback, useMemo } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { PlusIcon, BookOpen, GraduationCap } from "lucide-react-native";
import { Trans, Plural } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useSearchQuery } from "../_layout";
import { useAppInit } from "@/hooks/useAppInit";
import { DictionaryList } from "@/components/dictionary";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { useThemeColors } from "@/lib/theme";

/**
 * Formats nanoseconds to a human-readable elapsed time string.
 */
const formatElapsedTime = (nanoseconds: number): string => {
  if (nanoseconds < 1000) {
    return `${nanoseconds.toFixed(0)}ns`;
  } else if (nanoseconds < 1_000_000) {
    return `${(nanoseconds / 1000).toFixed(2)}μs`;
  } else if (nanoseconds < 1_000_000_000) {
    return `${(nanoseconds / 1_000_000).toFixed(2)}ms`;
  } else {
    return `${(nanoseconds / 1_000_000_000).toFixed(2)}s`;
  }
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
      className="mt-1 mb-4 rounded-xl bg-card overflow-hidden"
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
        <View className="flex-row items-center gap-3 mb-3">
          <View
            className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center"
            style={{
              borderWidth: 1,
              borderColor: `${colors.primary}33`, // 20% opacity
            }}
          >
            <BookOpen size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground tracking-tight">
              <Trans>Your Dictionary</Trans>
            </Text>
            <Text className="text-sm text-muted-foreground">
              {totalResults !== null ? (
                <>
                  <Plural
                    value={totalResults}
                    one={`${totalResults} result`}
                    other={`${totalResults} results`}
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
            onPress={onReviewPress}
            disabled={isPending}
            className={`flex-row items-center gap-1.5 px-3 h-9 rounded-lg ${
              dueCount > 0 ? "bg-warning/10" : "active:bg-primary/5"
            }`}
          >
            <GraduationCap
              size={16}
              color={dueCount > 0 ? colors.warning : colors.mutedForeground}
            />
            <Text
              style={dueCount > 0 ? { color: colors.warning } : undefined}
              className={`text-sm ${
                dueCount > 0 ? "" : "text-muted-foreground"
              } ${isPending ? "opacity-50" : ""}`}
            >
              <Trans>Review</Trans>
            </Text>
            {!isPending && dueCount > 0 && (
              <View
                style={{ backgroundColor: colors.warning }}
                className="rounded-full px-1.5 min-w-5 h-5 items-center justify-center ml-0.5"
              >
                <Text style={{ color: colors.warningForeground }} className="text-xs font-semibold">
                  {dueCount}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Spacer */}
          <View className="flex-1" />

          {/* Add Word Button */}
          <Pressable
            onPress={onAddPress}
            className="flex-row items-center gap-1.5 h-9 px-3 rounded-md bg-primary active:opacity-80"
            style={{
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <PlusIcon size={16} color={colors.primaryForeground} />
            <Text className="text-primary-foreground text-sm font-medium">
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
        totalResults={totalResults}
        elapsedTimeNs={elapsedTimeNs}
        dueCount={dueCount}
        isPending={isPending}
        onReviewPress={handleReviewPress}
        onAddPress={handleAddPress}
      />
    ),
    [totalResults, elapsedTimeNs, dueCount, isPending],
  );

  // Show loading state while initializing
  if (state === "loading" || state === "idle") {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted-foreground mt-4">
          <Trans>Loading your dictionary...</Trans>
        </Text>
      </View>
    );
  }

  // Show error state
  if (state === "error") {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-destructive text-lg font-medium mb-2">
          <Trans>Something went wrong</Trans>
        </Text>
        <Text className="text-muted-foreground text-center">{error}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Dictionary list with header */}
      <DictionaryList
        searchQuery={searchQuery}
        bottomInset={insets.bottom}
        onTotalCountChange={handleTotalCountChange}
        onElapsedTimeChange={handleElapsedTimeChange}
        ListHeaderComponent={listHeader}
      />
    </View>
  );
}
