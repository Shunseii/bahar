/**
 * Dictionary list component with infinite scroll using FlashList.
 */

import type {
  SelectDictionaryEntry,
  WordType,
} from "@bahar/drizzle-user-db-schemas";
import { Trans } from "@lingui/react/macro";
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from "@shopify/flash-list";
import { useFocusEffect } from "expo-router";
import { useAtom } from "jotai";
import { ArrowUp, BookOpen, SearchX } from "lucide-react-native";
import type { ReactElement } from "react";
import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useDragSelect } from "@/hooks/useDragSelect";
import { type SortOption, useInfiniteSearch } from "@/hooks/useSearch";
import { dictionaryEntriesTable } from "@/lib/db/operations";
import { performSync } from "@/lib/db/sync";
import { reviewsPendingRefreshAtom } from "@/lib/store";
import {
  useBulkSelection,
  usePublishAllMatchingIds,
} from "@/lib/store/selection";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";
import { DictionaryEntryCard } from "./DictionaryEntryCard";

interface DictionaryListProps {
  searchQuery: string;
  tags?: string[];
  types?: WordType[];
  sort?: SortOption;
  bottomInset?: number;
  onTotalCountChange?: (count: number) => void;
  onElapsedTimeChange?: (elapsedNs: number | null) => void;
  ListHeaderComponent?: ReactElement;
}

const EmptyDictionary: FC = () => {
  const colors = useThemeColors();
  return (
    <Animated.View
      className="flex-1 items-center justify-center py-16"
      entering={FadeIn.delay(150).duration(300)}
    >
      <View className="mb-4 rounded-full bg-muted/50 p-4">
        <BookOpen color={colors.mutedForeground} size={32} />
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
  const colors = useThemeColors();
  return (
    <Animated.View
      className="flex-1 items-center justify-center py-16"
      entering={FadeIn.delay(150).duration(300)}
    >
      <View className="mb-4 rounded-full bg-muted/50 p-4">
        <SearchX color={colors.mutedForeground} size={32} />
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
  tags,
  types,
  sort,
  bottomInset = 0,
  onTotalCountChange,
  onElapsedTimeChange,
  ListHeaderComponent,
}) => {
  const filters =
    tags?.length || types?.length
      ? {
          tags: tags?.length ? tags : undefined,
          types: types?.length ? types : undefined,
        }
      : undefined;
  const {
    hits,
    hasMore,
    isLoading,
    loadMore,
    refresh,
    totalCount,
    elapsedTimeNs,
    allMatchingIds,
  } = useInfiniteSearch({
    term: searchQuery,
    filters,
    sort,
  });

  const [reviewsPending, setReviewsPending] = useAtom(
    reviewsPendingRefreshAtom
  );

  // Grading a flashcard marks the results stale rather than re-searching
  // off-screen. Re-sort once, here, when the list is actually focused again.
  useFocusEffect(
    useCallback(() => {
      if (reviewsPending) {
        refresh();
        setReviewsPending(false);
      }
    }, [reviewsPending, refresh, setReviewsPending])
  );

  const listRef = useRef<FlashListRef<(typeof hits)[number]>>(null);
  const {
    selectionMode,
    selectedIds,
    toggle,
    setSelection,
    enterSelectionMode,
  } = useBulkSelection();

  // The gesture callbacks run outside React's render, so the live selection and
  // scroll position are read through refs rather than captured in a closure.
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const scrollOffsetRef = useRef(0);

  const orderedIds = hits.map((hit) => hit.id);

  const { gesture, registerRow, registerList } = useDragSelect({
    orderedIds,
    // The caller pads the list by the action bar's height while selecting; the
    // same padding is what auto-scroll has to stay clear of.
    bottomInset,
    getSelectedIds: () => selectedIdsRef.current,
    setSelection,
    enterSelectionMode,
    getScrollOffset: () => scrollOffsetRef.current,
    scrollToOffset: (offset) =>
      listRef.current?.scrollToOffset({ offset, animated: false }),
  });

  const [refreshing, setRefreshing] = useState(false);
  const expandedIdsRef = useRef(new Set<string>());
  const [expandedVersion, setExpandedVersion] = useState(0);

  useEffect(() => {
    expandedIdsRef.current.clear();
    setExpandedVersion((n) => n + 1);
  }, [searchQuery, tags, types, sort]);

  const toggleExpanded = useCallback((id: string) => {
    const set = expandedIdsRef.current;
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    setExpandedVersion((n) => n + 1);
  }, []);
  const colors = useThemeColors();
  const scrollY = useSharedValue(0);
  const { height: screenHeight } = useWindowDimensions();

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToTop({ animated: true });
  }, []);

  // A new query or filter set produces unrelated results, so land at the top
  // instead of keeping the previous offset. scrollY is reset alongside it because
  // a non-animated programmatic scroll doesn't reliably emit onScroll, which
  // would otherwise leave the scroll-to-top button visible.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    scrollY.value = 0;
  }, [searchQuery, tags, types, sort]);

  const scrollButtonStyle = useAnimatedStyle(() => {
    const show = scrollY.value > screenHeight;
    return {
      opacity: withTiming(show ? 1 : 0, { duration: 200 }),
      transform: [{ scale: withTiming(show ? 1 : 0.8, { duration: 200 }) }],
    };
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await performSync();
    } catch {
      refresh();
    } finally {
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

  usePublishAllMatchingIds(allMatchingIds);

  // Prefetch full entries from SQLite for the current batch of hits
  // so ExpandedDetails can read from a warm cache on expand
  const prefetchedIdsRef = useRef(new Set<string>());
  useEffect(() => {
    const newIds = hits
      .map((h) => h.id)
      .filter((id) => !prefetchedIdsRef.current.has(id));
    if (newIds.length === 0) return;

    for (const id of newIds) {
      prefetchedIdsRef.current.add(id);
    }

    dictionaryEntriesTable.entriesByIds.query({ ids: newIds }).then((map) => {
      for (const [id, entry] of map) {
        queryClient.setQueryData(
          [...dictionaryEntriesTable.entry.cacheOptions.queryKey, id],
          entry
        );
      }
    });
  }, [hits]);

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof hits)[0]; index: number }) => (
      // The plain wrapper is what drag-select measures: it exposes the native
      // measure methods (Animated.View's ref doesn't) and collapsable={false}
      // keeps Android from flattening it away.
      <View collapsable={false} ref={(node) => registerRow(item.id, node)}>
        <Animated.View
          entering={FadeInDown.delay(Math.min(index * 50, 300))
            .duration(400)
            .springify()
            .damping(15)
            .stiffness(120)}
          // Selection mode slides a checkbox in and shifts the word across, so
          // the row animates to its new shape instead of snapping.
          layout={LinearTransition.duration(180)}
        >
          <DictionaryEntryCard
            entry={item.document as SelectDictionaryEntry}
            isExpanded={expandedIdsRef.current.has(item.id)}
            isSelected={selectedIds.has(item.id)}
            onToggleExpand={toggleExpanded}
            onToggleSelect={toggle}
            searchQuery={searchQuery}
            selectionMode={selectionMode}
          />
        </Animated.View>
      </View>
    ),
    [
      toggleExpanded,
      registerRow,
      selectedIds,
      selectionMode,
      toggle,
      searchQuery,
    ]
  );

  const keyExtractor = useCallback((item: (typeof hits)[0]) => item.id, []);

  // FlashList only re-renders rows when extraData's identity changes, and both
  // expansion and selection live outside the row data.
  const extraData = useMemo(
    () => ({ expandedVersion, selectionMode, selectedIds }),
    [expandedVersion, selectionMode, selectedIds]
  );

  const onEndReached = useCallback(() => {
    if (!isLoading && hasMore) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  const emptyComponent = (() => {
    if (isLoading) return <LoadingIndicator />;
    if (searchQuery.trim()) return <NoResults />;
    return <EmptyDictionary />;
  })();

  return (
    <View className="flex-1" collapsable={false} ref={registerList}>
      <GestureDetector gesture={gesture}>
        <FlashList
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: bottomInset + 16,
          }}
          data={hits}
          extraData={extraData}
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
          onScroll={handleScroll}
          ref={listRef}
          refreshControl={
            <RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />
          }
          renderItem={renderItem}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        />
      </GestureDetector>
      <Animated.View
        className="absolute right-6"
        style={[{ bottom: bottomInset + 24 }, scrollButtonStyle]}
      >
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-primary"
          hitSlop={8}
          onPress={scrollToTop}
          style={{
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <ArrowUp color={colors.primaryForeground} size={20} />
        </Pressable>
      </Animated.View>
    </View>
  );
};
