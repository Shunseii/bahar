/**
 * Create/Edit deck form component.
 */

import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Switch } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";
import { X, Check, Tag, Filter } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { queryClient } from "../../utils/api";
import { decksTable } from "../../lib/db/operations/decks";
import { useThemeColors } from "@/lib/theme";
import type { SelectDeck, DeckFilters, WordType, FlashcardState } from "@bahar/drizzle-user-db-schemas";

interface CreateDeckFormProps {
  deck?: SelectDeck;
  onClose: () => void;
  onSuccess: () => void;
}

const WORD_TYPES: WordType[] = ["ism", "fi'l", "harf", "expression"];
const WORD_TYPE_LABELS: Record<WordType, string> = {
  ism: "Noun",
  "fi'l": "Verb",
  harf: "Preposition",
  expression: "Expression",
};

export const CreateDeckForm: React.FC<CreateDeckFormProps> = ({
  deck,
  onClose,
  onSuccess,
}) => {
  const colors = useThemeColors();
  const [name, setName] = useState(deck?.name ?? "");
  const [selectedTypes, setSelectedTypes] = useState<WordType[]>(
    deck?.filters?.types ?? [],
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(deck?.filters?.tags ?? []);

  const isEdit = !!deck;

  const { mutateAsync: createDeck, isPending: isCreating } = useMutation({
    mutationFn: decksTable.create.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
    },
  });

  const { mutateAsync: updateDeck, isPending: isUpdating } = useMutation({
    mutationFn: decksTable.update.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
    },
  });

  const isPending = isCreating || isUpdating;

  const handleSubmit = async () => {
    if (!name.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const filters: DeckFilters = {};
    if (selectedTypes.length > 0) {
      filters.types = selectedTypes;
    }
    if (tags.length > 0) {
      filters.tags = tags;
    }

    try {
      if (isEdit && deck) {
        await updateDeck({
          id: deck.id,
          updates: {
            name: name.trim(),
            filters,
          },
        });
      } else {
        await createDeck({
          deck: {
            name: name.trim(),
            filters,
          },
        });
      }
      onSuccess();
    } catch (error) {
      console.error("Failed to save deck:", error);
    }
  };

  const toggleType = (type: WordType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type],
    );
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border/30">
        <Pressable onPress={onClose} className="p-2">
          <X size={24} color={colors.mutedForeground} />
        </Pressable>
        <Text className="text-foreground text-lg font-semibold">
          {isEdit ? "Edit Deck" : "New Deck"}
        </Text>
        <Pressable
          onPress={handleSubmit}
          disabled={isPending || !name.trim()}
          className={`p-2 rounded-lg ${name.trim() ? "bg-primary" : "bg-muted"}`}
        >
          <Check size={24} color={name.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* Name input */}
        <View className="mb-6">
          <Text className="text-foreground font-medium mb-2">Deck Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My Deck"
            placeholderTextColor={colors.mutedForeground}
            className="bg-card border border-border/30 rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Word type filter */}
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <Filter size={16} color={colors.mutedForeground} />
            <Text className="text-foreground font-medium ml-2">Word Types</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {WORD_TYPES.map((type) => (
              <TypeChip
                key={type}
                label={WORD_TYPE_LABELS[type]}
                selected={selectedTypes.includes(type)}
                onPress={() => toggleType(type)}
              />
            ))}
          </View>
        </View>

        {/* Tags filter */}
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <Tag size={16} color={colors.mutedForeground} />
            <Text className="text-foreground font-medium ml-2">Tags</Text>
          </View>
          <View className="flex-row items-center mb-2">
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              placeholder="Add tag..."
              placeholderTextColor={colors.mutedForeground}
              className="flex-1 bg-card border border-border/30 rounded-xl px-4 py-3 text-foreground"
            />
            <Pressable
              onPress={addTag}
              className="ml-2 bg-primary px-4 py-3 rounded-xl"
            >
              <Text className="text-primary-foreground font-medium">Add</Text>
            </Pressable>
          </View>
          {tags.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {tags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => removeTag(tag)}
                  className="bg-secondary flex-row items-center px-3 py-1.5 rounded-lg"
                >
                  <Text className="text-secondary-foreground">{tag}</Text>
                  <X size={14} color={colors.mutedForeground} className="ml-1" />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
};

interface TypeChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const TypeChip: React.FC<TypeChipProps> = ({ label, selected, onPress }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View
        style={animatedStyle}
        className={`px-4 py-2 rounded-xl border ${
          selected
            ? "bg-primary border-primary"
            : "bg-card border-border/30"
        }`}
      >
        <Text
          className={
            selected ? "text-primary-foreground font-medium" : "text-foreground"
          }
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};
