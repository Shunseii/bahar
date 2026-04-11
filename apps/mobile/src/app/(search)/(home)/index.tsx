import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BookOpen, GraduationCap, PlusIcon } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DictionaryList } from "@/components/dictionary";
import { Button } from "@/components/ui/button";
import { useAppInit } from "@/hooks/useAppInit";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  flashcardsTable,
} from "@/lib/db/operations/flashcards";
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
}: {
  totalResults: number | null;
  elapsedTimeNs: number | null;
  regularCount: number;
  backlogCount: number;
  isPending: boolean;
  onReviewPress: () => void;
  onAddPress: () => void;
}) => {
  const colors = useThemeColors();

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

        <View className="flex-row items-center gap-2">
          <Button onPress={onAddPress} variant="outline">
            <View className="flex-row items-center gap-1.5">
              <PlusIcon color={colors.mutedForeground} size={16} />
              <Text className="text-foreground text-sm">
                <Trans>Add word</Trans>
              </Text>
            </View>
          </Button>

          <View className="flex-1" />

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
                      {regularCount}
                    </Text>
                  </View>
                )}
              </View>
            </Button>
            {backlogCount > 0 && <PulsingDot />}
          </View>
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

  const { data: counts, isPending } = useQuery({
    queryFn: () =>
      flashcardsTable.counts.query({
        backlogThresholdDays: DEFAULT_BACKLOG_THRESHOLD_DAYS,
      }),
    queryKey: flashcardsTable.counts.cacheOptions.queryKey,
    enabled: state === "ready",
    refetchOnMount: true,
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
      <HeaderCard
        backlogCount={backlogCount}
        elapsedTimeNs={elapsedTimeNs}
        isPending={isPending}
        onAddPress={handleAddPress}
        onReviewPress={handleReviewPress}
        regularCount={regularCount}
        totalResults={totalResults}
      />
    ),
    [totalResults, elapsedTimeNs, regularCount, backlogCount, isPending]
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
        bottomInset={insets.bottom}
        ListHeaderComponent={listHeader}
        onElapsedTimeChange={handleElapsedTimeChange}
        onTotalCountChange={handleTotalCountChange}
        searchQuery={searchQuery}
      />
    </View>
  );
}
