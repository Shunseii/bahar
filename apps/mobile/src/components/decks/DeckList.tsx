/**
 * Deck list component showing all user decks.
 */

import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Layers, Plus } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { syncDatabase } from "@/lib/db/adapter";
import { isSyncingAtom, store, syncCompletedCountAtom } from "@/lib/store";
import { decksTable } from "../../lib/db/operations/decks";
import { DeckCard } from "./DeckCard";

interface DeckListProps {
  onDeckPress: (
    deck: SelectDeck & { due_count: number; total_count: number }
  ) => void;
  onDeckLongPress?: (deck: SelectDeck) => void;
  onCreatePress: () => void;
}

export const DeckList: React.FC<DeckListProps> = ({
  onDeckPress,
  onDeckLongPress,
  onCreatePress,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: decks,
    status,
    refetch,
  } = useQuery({
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
        <Layers className="animate-pulse text-muted-foreground" size={48} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="p-4"
      refreshControl={
        <RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />
      }
    >
      {/* Header */}
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-bold text-2xl text-foreground">Decks</Text>
        <Pressable
          className="rounded-xl bg-primary p-2"
          onPress={handleCreatePress}
        >
          <Plus className="text-primary-foreground" size={24} />
        </Pressable>
      </View>

      {/* Empty state */}
      {(!decks || decks.length === 0) && (
        <Animated.View
          className="items-center py-12"
          entering={FadeIn.duration(300)}
        >
          <View className="mb-4 rounded-2xl bg-muted/50 p-4">
            <Layers className="text-muted-foreground" size={48} />
          </View>
          <Text className="mb-2 font-semibold text-foreground text-lg">
            No decks yet
          </Text>
          <Text className="max-w-xs text-center text-muted-foreground">
            Create your first deck to organize your flashcards with custom
            filters.
          </Text>
        </Animated.View>
      )}

      {/* Deck list */}
      <View className="gap-3">
        {decks?.map((deck, index) => (
          <Animated.View
            entering={FadeIn.delay(index * 50).duration(300)}
            exiting={FadeOut.duration(200)}
            key={deck.id}
            layout={Layout.springify()}
          >
            <DeckCard
              deck={deck}
              onLongPress={
                onDeckLongPress ? () => onDeckLongPress(deck) : undefined
              }
              onPress={() => onDeckPress(deck)}
            />
          </Animated.View>
        ))}
      </View>

      {/* All cards deck (always available) */}
      <Animated.View
        className="mt-6"
        entering={FadeIn.delay((decks?.length ?? 0) * 50 + 100).duration(300)}
      >
        <Text className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
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
