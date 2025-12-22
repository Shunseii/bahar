/**
 * Dictionary list component with infinite scroll using FlashList.
 */

import { FC, useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, RefreshControl } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Trans } from "@lingui/react/macro";
import { BookOpen, SearchX } from "lucide-react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { DictionaryEntryCard } from "./DictionaryEntryCard";
import { useInfiniteSearch } from "@/hooks/useSearch";
import { useThemeColors } from "@/lib/theme";
import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { syncDatabase } from "@/lib/db/adapter";
import { store, syncCompletedCountAtom, isSyncingAtom } from "@/lib/store";
import type { ReactNode } from "react";

interface DictionaryListProps {
  searchQuery: string;
  bottomInset?: number;
  onTotalCountChange?: (count: number) => void;
  onElapsedTimeChange?: (elapsedNs: number | null) => void;
  ListHeaderComponent?: ReactNode;
}

const EmptyDictionary: FC = () => {
  const colors = useThemeColors();

  return (
    <Animated.View
      entering={FadeIn.delay(150).duration(300)}
      className="flex-1 items-center justify-center py-16"
    >
      <View className="p-4 rounded-full bg-muted/50 mb-4">
        <BookOpen size={32} color={colors.mutedForeground} />
      </View>
      <Text className="text-lg font-medium text-foreground mb-1">
        <Trans>Your dictionary is empty</Trans>
      </Text>
      <Text className="text-muted-foreground text-center px-8">
        <Trans>Add some words to get started!</Trans>
      </Text>
    </Animated.View>
  );
};

const NoResults: FC = () => {
  const colors = useThemeColors();

  return (
    <Animated.View
      entering={FadeIn.delay(150).duration(300)}
      className="flex-1 items-center justify-center py-16"
    >
      <View className="p-4 rounded-full bg-muted/50 mb-4">
        <SearchX size={32} color={colors.mutedForeground} />
      </View>
      <Text className="text-lg font-medium text-foreground mb-1">
        <Trans>No results found</Trans>
      </Text>
      <Text className="text-muted-foreground text-center px-8">
        <Trans>Try a different search term</Trans>
      </Text>
    </Animated.View>
  );
};

const LoadingIndicator: FC = () => (
  <View className="py-6 items-center">
    <ActivityIndicator size="small" />
  </View>
);

export const DictionaryList: FC<DictionaryListProps> = ({
  searchQuery,
  bottomInset = 0,
  onTotalCountChange,
  onElapsedTimeChange,
  ListHeaderComponent,
}) => {
  const { hits, hasMore, isLoading, loadMore, refresh, totalCount, elapsedTimeNs } = useInfiniteSearch(searchQuery);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    store.set(isSyncingAtom, true);
    try {
      await syncDatabase();
      store.set(syncCompletedCountAtom, (c) => c + 1);
    } catch (error) {
      console.warn("[DictionaryList] Pull-to-refresh sync failed:", error);
      refresh();
    } finally {
      store.set(isSyncingAtom, false);
      setRefreshing(false);
    }
  };

  // Notify parent of count changes
  useEffect(() => {
    onTotalCountChange?.(totalCount);
  }, [totalCount, onTotalCountChange]);

  // Notify parent of elapsed time changes
  useEffect(() => {
    onElapsedTimeChange?.(elapsedTimeNs);
  }, [elapsedTimeNs, onElapsedTimeChange]);

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof hits)[0]; index: number }) => (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index * 50, 300))
          .duration(400)
          .springify()
          .damping(15)
          .stiffness(120)}
      >
        <DictionaryEntryCard entry={item.document as SelectDictionaryEntry} />
      </Animated.View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: (typeof hits)[0]) => item.id!, []);

  const onEndReached = useCallback(() => {
    if (!isLoading && hasMore) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  // Empty state component that shows below the header
  const emptyComponent = !isLoading ? (
    searchQuery.trim() ? <NoResults /> : <EmptyDictionary />
  ) : null;

  return (
    <FlashList
      data={hits}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: bottomInset + 16,
      }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={ListHeaderComponent ? <>{ListHeaderComponent}</> : null}
      ListEmptyComponent={emptyComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      ListFooterComponent={hasMore ? <LoadingIndicator /> : null}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
};
