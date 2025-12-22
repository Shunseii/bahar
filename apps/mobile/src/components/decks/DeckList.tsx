/**
 * Deck list component showing all user decks.
 */

import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { Plus, Layers } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { decksTable } from "../../lib/db/operations/decks";
import { DeckCard } from "./DeckCard";
import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import { syncDatabase } from "@/lib/db/adapter";
import { store, syncCompletedCountAtom, isSyncingAtom } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

interface DeckListProps {
  onDeckPress: (deck: SelectDeck & { due_count: number; total_count: number }) => void;
  onDeckLongPress?: (deck: SelectDeck) => void;
  onCreatePress: () => void;
}

export const DeckList: React.FC<DeckListProps> = ({
  onDeckPress,
  onDeckLongPress,
  onCreatePress,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const colors = useThemeColors();

  const { data: decks, status, refetch } = useQuery({
    queryFn: () => decksTable.list.query(),
    ...decksTable.list.cacheOptions,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    store.set(isSyncingAtom, true);
    try {
      await syncDatabase();
      store.set(syncCompletedCountAtom, (c) => c + 1);
    } catch (error) {
      console.warn("[DeckList] Pull-to-refresh sync failed:", error);
      await refetch();
    } finally {
      store.set(isSyncingAtom, false);
      setRefreshing(false);
    }
  };

  const handleCreatePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCreatePress();
  };

  if (status === "pending") {
    return (
      <View className="flex-1 items-center justify-center">
        <Layers size={48} className="text-muted-foreground animate-pulse" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="p-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-foreground text-2xl font-bold">Decks</Text>
        <Pressable
          onPress={handleCreatePress}
          className="bg-primary p-2 rounded-xl"
        >
          <Plus size={24} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {/* Empty state */}
      {(!decks || decks.length === 0) && (
        <Animated.View
          entering={FadeIn.duration(300)}
          className="items-center py-12"
        >
          <View className="p-4 rounded-2xl bg-muted/50 mb-4">
            <Layers size={48} color={colors.mutedForeground} />
          </View>
          <Text className="text-foreground text-lg font-semibold mb-2">
            No decks yet
          </Text>
          <Text className="text-muted-foreground text-center max-w-xs">
            Create your first deck to organize your flashcards with custom filters.
          </Text>
        </Animated.View>
      )}

      {/* Deck list */}
      <View className="gap-3">
        {decks?.map((deck, index) => (
          <Animated.View
            key={deck.id}
            entering={FadeIn.delay(index * 50).duration(300)}
            exiting={FadeOut.duration(200)}
            layout={Layout.springify()}
          >
            <DeckCard
              deck={deck}
              onPress={() => onDeckPress(deck)}
              onLongPress={onDeckLongPress ? () => onDeckLongPress(deck) : undefined}
            />
          </Animated.View>
        ))}
      </View>

      {/* All cards deck (always available) */}
      <Animated.View
        entering={FadeIn.delay((decks?.length ?? 0) * 50 + 100).duration(300)}
        className="mt-6"
      >
        <Text className="text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wide">
          Default
        </Text>
        <DeckCard
          deck={{
            id: "all",
            name: "All Cards",
            filters: {},
            due_count: decks?.reduce((acc, d) => acc + d.due_count, 0) ?? 0,
            total_count: decks?.reduce((acc, d) => acc + d.total_count, 0) ?? 0,
          }}
          onPress={() =>
            onDeckPress({
              id: "all",
              name: "All Cards",
              filters: {},
              due_count: 0,
              total_count: 0,
            })
          }
        />
      </Animated.View>
    </ScrollView>
  );
};
