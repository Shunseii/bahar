import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Edit, Layers, Play, Plus, Trash2, X } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { syncDatabase } from "@/lib/db/adapter";
import { decksTable } from "@/lib/db/operations/decks";
import { isSyncingAtom, store, syncCompletedCountAtom } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";

interface DeckCardProps {
  deck: SelectDeck & { due_count: number; total_count: number };
  onStudy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const DeckCard: React.FC<DeckCardProps> = ({
  deck,
  onStudy,
  onEdit,
  onDelete,
}) => {
  const colors = useThemeColors();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify()}
    >
      <Card className="mb-3">
        <CardContent className="pt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="mb-1 flex-row items-center gap-2">
                <Layers className="text-muted-foreground" size={18} />
                <Text className="font-semibold text-foreground text-lg">
                  {deck.name}
                </Text>
              </View>
              <Text className="text-muted-foreground text-sm">
                {deck.due_count > 0 ? (
                  <Trans>{deck.due_count} cards due</Trans>
                ) : (
                  <Trans>No cards due</Trans>
                )}
                {" · "}
                <Trans>{deck.total_count} total</Trans>
              </Text>
            </View>

            <View className="flex-row items-center gap-1">
              <Pressable
                className="rounded-md p-2 active:bg-primary/10"
                disabled={deck.due_count === 0}
                onPress={onStudy}
              >
                <Play
                  className={
                    deck.due_count > 0
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                  fill={deck.due_count > 0 ? colors.primary : "transparent"}
                  size={20}
                />
              </Pressable>
              <Pressable
                className="rounded-md p-2 active:bg-primary/10"
                onPress={onEdit}
              >
                <Edit className="text-muted-foreground" size={18} />
              </Pressable>
              <Pressable
                className="rounded-md p-2 active:bg-destructive/10"
                onPress={onDelete}
              >
                <Trash2 className="text-destructive" size={18} />
              </Pressable>
            </View>
          </View>
        </CardContent>
      </Card>
    </Animated.View>
  );
};

interface CreateEditDeckModalProps {
  visible: boolean;
  onClose: () => void;
  editingDeck?: SelectDeck | null;
}

const CreateEditDeckModal: React.FC<CreateEditDeckModalProps> = ({
  visible,
  onClose,
  editingDeck,
}) => {
  const { t: translate } = useLingui();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors(); // Keep for placeholderTextColor
  const [name, setName] = useState(editingDeck?.name ?? "");

  React.useEffect(() => {
    if (visible) {
      setName(editingDeck?.name ?? "");
    }
  }, [visible, editingDeck]);

  const createMutation = useMutation({
    mutationFn: decksTable.create.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
      toast.success(t`Deck created`);
      onClose();
    },
    onError: () => toast.error(t`Failed to create deck`),
  });

  const updateMutation = useMutation({
    mutationFn: decksTable.update.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
      toast.success(t`Deck updated`);
      onClose();
    },
    onError: () => toast.error(t`Failed to update deck`),
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast.error(t`Please enter a deck name`);
      return;
    }

    if (editingDeck) {
      updateMutation.mutate({
        id: editingDeck.id,
        updates: { name: name.trim() },
      });
    } else {
      createMutation.mutate({ deck: { name: name.trim() } });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between border-border border-b px-4 py-3">
          <Pressable className="-ml-2 p-2" onPress={onClose}>
            <X className="text-foreground" size={24} />
          </Pressable>
          <Text className="font-semibold text-foreground text-lg">
            {editingDeck ? (
              <Trans>Edit Deck</Trans>
            ) : (
              <Trans>Create Deck</Trans>
            )}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <View className="flex-1 px-4 pt-6">
          <View className="mb-6 gap-2">
            <Text className="font-medium text-foreground text-sm">
              <Trans>Deck Name</Trans>
            </Text>
            <TextInput
              autoFocus
              className="rounded-md border border-border bg-background px-3 py-3 text-foreground"
              onChangeText={setName}
              placeholder={translate`Enter deck name`}
              placeholderTextColor={colors.mutedForeground}
              value={name}
            />
          </View>

          <Button disabled={isLoading || !name.trim()} onPress={handleSave}>
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : editingDeck ? (
              <Trans>Save Changes</Trans>
            ) : (
              <Trans>Create Deck</Trans>
            )}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default function DecksScreen() {
  const router = useRouter();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<SelectDeck | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: decks,
    isLoading,
    refetch,
  } = useQuery({
    queryFn: decksTable.list.query,
    ...decksTable.list.cacheOptions,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    store.set(isSyncingAtom, true);
    try {
      await syncDatabase();
      store.set(syncCompletedCountAtom, (c) => c + 1);
    } catch (error) {
      console.warn("[DecksScreen] Pull-to-refresh sync failed:", error);
      await refetch();
    } finally {
      store.set(isSyncingAtom, false);
      setRefreshing(false);
    }
  };

  const handleStudy = (deck: SelectDeck) => {
    router.push({
      pathname: "/review",
      params: {
        filters: deck.filters ? JSON.stringify(deck.filters) : undefined,
      },
    });
  };

  const deleteMutation = useMutation({
    mutationFn: decksTable.delete.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
      toast.success(t`Deck deleted`);
    },
    onError: () => toast.error(t`Failed to delete deck`),
  });

  const handleDelete = (deck: SelectDeck) => {
    Alert.alert(
      t`Delete Deck`,
      t`Are you sure you want to delete "${deck.name}"?`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: deck.id }),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-border border-b px-4 py-3">
        <Text className="font-bold text-foreground text-xl">
          <Trans>Decks</Trans>
        </Text>
        <Button
          Icon={Plus}
          onPress={() => setShowCreateModal(true)}
          variant="outline"
        >
          <Trans>Create</Trans>
        </Button>
      </View>

      {/* Deck list */}
      {decks?.length ? (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={decks}
          keyExtractor={(item) => item.id}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          renderItem={({ item }) => (
            <DeckCard
              deck={item}
              onDelete={() => handleDelete(item)}
              onEdit={() => {
                setEditingDeck(item);
                setShowCreateModal(true);
              }}
              onStudy={() => handleStudy(item)}
            />
          )}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 rounded-full bg-muted/50 p-4">
            <Layers className="text-muted-foreground" size={32} />
          </View>
          <Text className="mb-1 text-center font-medium text-foreground text-lg">
            <Trans>No decks yet</Trans>
          </Text>
          <Text className="mb-4 text-center text-muted-foreground">
            <Trans>Create a deck to organize your flashcard reviews</Trans>
          </Text>
          <Button Icon={Plus} onPress={() => setShowCreateModal(true)}>
            <Trans>Create your first deck</Trans>
          </Button>
        </View>
      )}

      {/* Create/Edit Modal */}
      <CreateEditDeckModal
        editingDeck={editingDeck}
        onClose={() => {
          setShowCreateModal(false);
          setEditingDeck(null);
        }}
        visible={showCreateModal}
      />
    </View>
  );
}
