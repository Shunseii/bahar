import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Layers, Plus } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { DeckCard } from "@/components/decks/DeckCard";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useCollapsibleHeader } from "@/hooks/useCollapsibleHeader";
import { type DeckWithCounts, decksTable } from "@/lib/db/operations";
import { performSync } from "@/lib/db/sync";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";

export default function DecksListScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { scrollHandler } = useCollapsibleHeader(t`Decks`);
  const [refreshing, setRefreshing] = useState(false);

  const { data: decks, status } = useQuery({
    queryFn: () => decksTable.list.query(),
    ...decksTable.list.cacheOptions,
  });

  const { mutateAsync: deleteDeck } = useMutation({
    mutationFn: decksTable.delete.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await performSync();
    } catch {
      // sync error already handled in performSync
    } finally {
      setRefreshing(false);
    }
  };

  const handleStudy = (deck: DeckWithCounts) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/review",
      params: {
        filters: JSON.stringify(deck.filters ?? {}),
        regularCount: String(deck.to_review),
        backlogCount: String(deck.to_review_backlog),
      },
    });
  };

  const handleMenu = (deck: DeckWithCounts) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(deck.name, undefined, [
      {
        text: t`Edit`,
        onPress: () => router.push(`/(search)/decks/edit/${deck.id}`),
      },
      {
        text: t`Delete`,
        style: "destructive",
        onPress: () => {
          Alert.alert(
            t`Delete "${deck.name}"?`,
            t`This cannot be undone. Your words and flashcards will not be affected.`,
            [
              { text: t`Cancel`, style: "cancel" },
              {
                text: t`Delete`,
                style: "destructive",
                onPress: () => deleteDeck({ id: deck.id }),
              },
            ]
          );
        },
      },
      { text: t`Cancel`, style: "cancel" },
    ]);
  };

  if (status === "pending") {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Animated.ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pb-safe-offset-6"
      onScroll={scrollHandler}
      refreshControl={
        <RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />
      }
      scrollEventThrottle={16}
    >
      <ScreenHeader
        icon={Layers}
        right={
          <Button
            Icon={Plus}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(search)/decks/create");
            }}
            variant="outline"
          >
            <Trans>New Deck</Trans>
          </Button>
        }
        title={t`Decks`}
      />

      <View className="gap-4 px-4 pt-4">
        {/* Empty state */}
        {(!decks || decks.length === 0) && (
          <Animated.View
            className="items-center py-12"
            entering={FadeIn.duration(300)}
          >
            <View className="mb-4 rounded-2xl bg-muted/50 p-4">
              <Layers color={colors.mutedForeground} size={48} />
            </View>
            <Text className="mb-2 font-semibold text-foreground text-lg">
              <Trans>No decks yet</Trans>
            </Text>
            <Text className="max-w-xs text-center text-muted-foreground">
              <Trans>
                Create your first deck to organize your flashcards with custom
                filters.
              </Trans>
            </Text>
          </Animated.View>
        )}

        {/* Deck cards */}
        {decks?.map((deck, index) => (
          <Animated.View
            entering={FadeIn.delay(index * 50).duration(300)}
            exiting={FadeOut.duration(200)}
            key={deck.id}
            layout={LinearTransition.springify()}
          >
            <DeckCard
              deck={deck}
              onMenu={() => handleMenu(deck)}
              onStudy={() => handleStudy(deck)}
            />
          </Animated.View>
        ))}
      </View>
    </Animated.ScrollView>
  );
}
