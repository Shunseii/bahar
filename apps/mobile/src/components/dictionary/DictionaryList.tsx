/**
 * Dictionary list component with infinite scroll using FlashList.
 */

import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { Trans } from "@lingui/react/macro";
import { FlashList, type FlashListProps } from "@shopify/flash-list";
import { BookOpen, SearchX } from "lucide-react-native";
import type { ReactElement } from "react";
import { type FC, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useInfiniteSearch } from "@/hooks/useSearch";
import { syncDatabase } from "@/lib/db/adapter";
import { isSyncingAtom, store, syncCompletedCountAtom } from "@/lib/store";
import { DictionaryEntryCard } from "./DictionaryEntryCard";

interface DictionaryListProps {
  searchQuery: string;
  bottomInset?: number;
  onTotalCountChange?: (count: number) => void;
  onElapsedTimeChange?: (elapsedNs: number | null) => void;
  ListHeaderComponent?: ReactElement;
}

const EmptyDictionary: FC = () => {
  return (
    <Animated.View
      className="flex-1 items-center justify-center py-16"
      entering={FadeIn.delay(150).duration(300)}
    >
      <View className="mb-4 rounded-full bg-muted/50 p-4">
        <BookOpen className="text-muted-foreground" size={32} />
      </View>
      <Text className="mb-1 font-medium text-foreground text-lg">
        <Trans>Your dictionary is empty</Trans>
      </Text>
      <Text className="px-8 text-center text-muted-foreground">
        <Trans>Add some words to get started!</Trans>
      </Text>
    </Animated.View>
  );
};

const NoResults: FC = () => {
  return (
    <Animated.View
      className="flex-1 items-center justify-center py-16"
      entering={FadeIn.delay(150).duration(300)}
    >
      <View className="mb-4 rounded-full bg-muted/50 p-4">
        <SearchX className="text-muted-foreground" size={32} />
      </View>
      <Text className="mb-1 font-medium text-foreground text-lg">
        <Trans>No results found</Trans>
      </Text>
      <Text className="px-8 text-center text-muted-foreground">
        <Trans>Try a different search term</Trans>
      </Text>
    </Animated.View>
  );
};

const LoadingIndicator: FC = () => (
  <View className="items-center py-6">
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
  const {
    hits,
    hasMore,
    isLoading,
    loadMore,
    refresh,
    totalCount,
    elapsedTimeNs,
  } = useInfiniteSearch(searchQuery);
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
    []
  );

  const keyExtractor = useCallback((item: (typeof hits)[0]) => item.id, []);

  const onEndReached = useCallback(() => {
    if (!isLoading && hasMore) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  const emptyComponent = (() => {
    if (isLoading) return null;
    if (searchQuery.trim()) return <NoResults />;
    return <EmptyDictionary />;
  })();
  return (
    <FlashList
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: bottomInset + 16,
      }}
      data={hits}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      keyExtractor={keyExtractor}
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={hasMore ? <LoadingIndicator /> : null}
      ListHeaderComponent={
        ListHeaderComponent as FlashListProps<
          (typeof hits)[0]
        >["ListHeaderComponent"]
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />
      }
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
    />
  );
};
