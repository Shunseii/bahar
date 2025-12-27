/**
 * Create/Edit deck form component.
 */

import type {
  DeckFilters,
  SelectDeck,
  WordType,
} from "@bahar/drizzle-user-db-schemas";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Check, Filter, Tag, X } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme";
import { decksTable } from "../../lib/db/operations/decks";
import { queryClient } from "../../utils/api";

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
    deck?.filters?.types ?? []
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
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
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
      className="flex-1 bg-background"
      entering={FadeIn.duration(200)}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between border-border/30 border-b p-4">
        <Pressable className="p-2" onPress={onClose}>
          <X className="text-muted-foreground" size={24} />
        </Pressable>
        <Text className="font-semibold text-foreground text-lg">
          {isEdit ? "Edit Deck" : "New Deck"}
        </Text>
        <Pressable
          className={`rounded-lg p-2 ${name.trim() ? "bg-primary" : "bg-muted"}`}
          disabled={isPending || !name.trim()}
          onPress={handleSubmit}
        >
          <Check
            className={
              name.trim() ? "text-primary-foreground" : "text-muted-foreground"
            }
            size={24}
          />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* Name input */}
        <View className="mb-6">
          <Text className="mb-2 font-medium text-foreground">Deck Name</Text>
          <TextInput
            className="rounded-xl border border-border/30 bg-card px-4 py-3 text-foreground"
            onChangeText={setName}
            placeholder="My Deck"
            placeholderTextColor={colors.mutedForeground}
            value={name}
          />
        </View>

        {/* Word type filter */}
        <View className="mb-6">
          <View className="mb-2 flex-row items-center">
            <Filter className="text-muted-foreground" size={16} />
            <Text className="ml-2 font-medium text-foreground">Word Types</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {WORD_TYPES.map((type) => (
              <TypeChip
                key={type}
                label={WORD_TYPE_LABELS[type]}
                onPress={() => toggleType(type)}
                selected={selectedTypes.includes(type)}
              />
            ))}
          </View>
        </View>

        {/* Tags filter */}
        <View className="mb-6">
          <View className="mb-2 flex-row items-center">
            <Tag className="text-muted-foreground" size={16} />
            <Text className="ml-2 font-medium text-foreground">Tags</Text>
          </View>
          <View className="mb-2 flex-row items-center">
            <TextInput
              className="flex-1 rounded-xl border border-border/30 bg-card px-4 py-3 text-foreground"
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              placeholder="Add tag..."
              placeholderTextColor={colors.mutedForeground}
              value={tagInput}
            />
            <Pressable
              className="ml-2 rounded-xl bg-primary px-4 py-3"
              onPress={addTag}
            >
              <Text className="font-medium text-primary-foreground">Add</Text>
            </Pressable>
          </View>
          {tags.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {tags.map((tag) => (
                <Pressable
                  className="flex-row items-center rounded-lg bg-secondary px-3 py-1.5"
                  key={tag}
                  onPress={() => removeTag(tag)}
                >
                  <Text className="text-secondary-foreground">{tag}</Text>
                  <X className="ml-1 text-muted-foreground" size={14} />
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
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        className={`rounded-xl border px-4 py-2 ${
          selected ? "border-primary bg-primary" : "border-border/30 bg-card"
        }`}
        style={animatedStyle}
      >
        <Text
          className={
            selected ? "font-medium text-primary-foreground" : "text-foreground"
          }
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};
