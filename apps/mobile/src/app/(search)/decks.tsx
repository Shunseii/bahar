import React, { useState } from "react";
import {
  Text,
  View,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from "react-native";
import { Trans, useLingui } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { Plus, Layers, Play, Trash2, Edit, X } from "lucide-react-native";
import { decksTable } from "@/lib/db/operations/decks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/utils/api";
import { toast } from "sonner-native";
import { useThemeColors } from "@/lib/theme";
import type { SelectDeck } from "@bahar/drizzle-user-db-schemas";
import { syncDatabase } from "@/lib/db/adapter";
import { store, syncCompletedCountAtom, isSyncingAtom } from "@/lib/store";

interface DeckCardProps {
  deck: SelectDeck & { due_count: number; total_count: number };
  onStudy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const DeckCard: React.FC<DeckCardProps> = ({ deck, onStudy, onEdit, onDelete }) => {
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
              <View className="flex-row items-center gap-2 mb-1">
                <Layers size={18} color={colors.mutedForeground} />
                <Text className="text-lg font-semibold text-foreground">{deck.name}</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
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
                onPress={onStudy}
                className="p-2 rounded-md active:bg-primary/10"
                disabled={deck.due_count === 0}
              >
                <Play
                  size={20}
                  color={deck.due_count > 0 ? colors.primary : colors.mutedForeground}
                  fill={deck.due_count > 0 ? colors.primary : "transparent"}
                />
              </Pressable>
              <Pressable onPress={onEdit} className="p-2 rounded-md active:bg-primary/10">
                <Edit size={18} color={colors.mutedForeground} />
              </Pressable>
              <Pressable onPress={onDelete} className="p-2 rounded-md active:bg-destructive/10">
                <Trash2 size={18} color={colors.destructive} />
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
  const colors = useThemeColors();
  const [name, setName] = useState(editingDeck?.name ?? "");

  React.useEffect(() => {
    if (visible) {
      setName(editingDeck?.name ?? "");
    }
  }, [visible, editingDeck]);

  const createMutation = useMutation({
    mutationFn: decksTable.create.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: decksTable.list.cacheOptions.queryKey });
      toast.success(t`Deck created`);
      onClose();
    },
    onError: () => toast.error(t`Failed to create deck`),
  });

  const updateMutation = useMutation({
    mutationFn: decksTable.update.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: decksTable.list.cacheOptions.queryKey });
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
      updateMutation.mutate({ id: editingDeck.id, updates: { name: name.trim() } });
    } else {
      createMutation.mutate({ deck: { name: name.trim() } });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose} className="p-2 -ml-2">
            <X size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">
            {editingDeck ? <Trans>Edit Deck</Trans> : <Trans>Create Deck</Trans>}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <View className="flex-1 px-4 pt-6">
          <View className="gap-2 mb-6">
            <Text className="text-sm font-medium text-foreground">
              <Trans>Deck Name</Trans>
            </Text>
            <TextInput
              className="border border-border rounded-md px-3 py-3 text-foreground bg-background"
              placeholder={translate`Enter deck name`}
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          <Button onPress={handleSave} disabled={isLoading || !name.trim()}>
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
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
  const colors = useThemeColors();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<SelectDeck | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: decks, isLoading, refetch } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: decksTable.list.cacheOptions.queryKey });
      toast.success(t`Deck deleted`);
    },
    onError: () => toast.error(t`Failed to delete deck`),
  });

  const handleDelete = (deck: SelectDeck) => {
    Alert.alert(t`Delete Deck`, t`Are you sure you want to delete "${deck.name}"?`, [
      { text: t`Cancel`, style: "cancel" },
      {
        text: t`Delete`,
        style: "destructive",
        onPress: () => deleteMutation.mutate({ id: deck.id }),
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-xl font-bold text-foreground">
          <Trans>Decks</Trans>
        </Text>
        <Button variant="outline" onPress={() => setShowCreateModal(true)} Icon={Plus}>
          <Trans>Create</Trans>
        </Button>
      </View>

      {/* Deck list */}
      {!decks?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="p-4 rounded-full bg-muted/50 mb-4">
            <Layers size={32} color={colors.mutedForeground} />
          </View>
          <Text className="text-lg font-medium text-foreground mb-1 text-center">
            <Trans>No decks yet</Trans>
          </Text>
          <Text className="text-muted-foreground text-center mb-4">
            <Trans>Create a deck to organize your flashcard reviews</Trans>
          </Text>
          <Button onPress={() => setShowCreateModal(true)} Icon={Plus}>
            <Trans>Create your first deck</Trans>
          </Button>
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <DeckCard
              deck={item}
              onStudy={() => handleStudy(item)}
              onEdit={() => {
                setEditingDeck(item);
                setShowCreateModal(true);
              }}
              onDelete={() => handleDelete(item)}
            />
          )}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Create/Edit Modal */}
      <CreateEditDeckModal
        visible={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingDeck(null);
        }}
        editingDeck={editingDeck}
      />
    </View>
  );
}
