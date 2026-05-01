import type { DeckFilters, WordType } from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocales } from "expo-localization";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { toast } from "sonner-native";
import { TagsInput } from "@/components/dictionary/form";
import { Button } from "@/components/ui/button";
import { useCollapsibleHeader } from "@/hooks/useCollapsibleHeader";
import { decksTable } from "@/lib/db/operations/decks";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";

const WORD_TYPES: WordType[] = ["ism", "fi'l", "harf", "expression"];

const useWordTypeLabels = (): Record<WordType, string> => {
  const { t } = useLingui();
  return {
    ism: t`Ism`,
    "fi'l": t`Fi'l`,
    harf: t`Harf`,
    expression: t`Expression`,
  };
};

export default function EditDeckScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scrollHandler } = useCollapsibleHeader(t`Edit deck`);
  const wordTypeLabels = useWordTypeLabels();

  const { data: deck, status } = useQuery({
    queryFn: () => decksTable.get.query({ id }),
    queryKey: [...decksTable.get.cacheOptions.queryKey, id],
    enabled: !!id,
  });

  const [name, setName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<WordType[]>([]);
  const [tags, setTags] = useState<{ name: string }[]>([]);

  useEffect(() => {
    if (deck) {
      setName(deck.name);
      setSelectedTypes(deck.filters?.types ?? []);
      setTags((deck.filters?.tags ?? []).map((t) => ({ name: t })));
    }
  }, [deck]);

  const invalidateDeckQueries = () => {
    queryClient.invalidateQueries({
      queryKey: decksTable.list.cacheOptions.queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: [...decksTable.get.cacheOptions.queryKey, id],
    });
  };

  const { mutateAsync: updateDeck, isPending: isUpdating } = useMutation({
    mutationFn: decksTable.update.mutation,
    onSuccess: () => {
      invalidateDeckQueries();
      toast.success(t`Deck updated`);
      router.back();
    },
    onError: (error) => {
      toast.error(t`Failed to update deck`);
      console.error("Update deck error:", error);
    },
  });

  const { mutateAsync: deleteDeck, isPending: isDeleting } = useMutation({
    mutationFn: decksTable.delete.mutation,
    onSuccess: () => {
      invalidateDeckQueries();
      toast.success(t`Deck deleted`);
      router.back();
    },
  });

  const handleSubmit = async () => {
    if (!name.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const filters: DeckFilters = {};
    if (selectedTypes.length > 0) filters.types = selectedTypes;
    if (tags.length > 0) filters.tags = tags.map((t) => t.name);

    await updateDeck({ id, updates: { name: name.trim(), filters } });
  };

  const handleDelete = () => {
    Alert.alert(
      t`Delete "${name}"?`,
      t`This cannot be undone. Your words and flashcards will not be affected.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: () => deleteDeck({ id }),
        },
      ]
    );
  };

  const toggleType = (type: WordType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  if (status === "pending" || !deck) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      bottomOffset={20}
      className="flex-1 bg-background"
      contentContainerClassName="pb-safe-offset-6"
      keyboardShouldPersistTaps="handled"
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      <View className="flex-1 px-4 pt-4">
        <Breadcrumbs />

        <View className="gap-y-4">
          <View className="flex-row items-center gap-4">
            <BackButton />
            <Text className="flex-1 font-semibold text-foreground text-xl tracking-tight">
              <Trans>Edit deck</Trans>
            </Text>
          </View>

          {/* Name card */}
          <View className="rounded-xl border border-border bg-card">
            <View className="px-4 pt-4 pb-2">
              <Text className="font-semibold text-base text-foreground">
                <Trans>Deck Name</Trans>
              </Text>
            </View>
            <View className="px-4 pt-2 pb-4">
              <TextInput
                className="h-11 rounded-lg border border-border bg-background px-3 text-foreground"
                onChangeText={setName}
                placeholder={t`e.g. Essential Vocabulary`}
                placeholderTextColor={colors.mutedForeground}
                value={name}
              />
            </View>
          </View>

          {/* Word Types card */}
          <View className="rounded-xl border border-border bg-card">
            <View className="gap-1 px-4 pt-4 pb-2">
              <Text className="font-semibold text-base text-foreground">
                <Trans>Word Types</Trans>
              </Text>
              <Text className="text-muted-foreground text-sm">
                <Trans>Select which types of words to include</Trans>
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2 px-4 pt-2 pb-4">
              {WORD_TYPES.map((type) => (
                <TypeChip
                  key={type}
                  label={wordTypeLabels[type]}
                  onPress={() => toggleType(type)}
                  selected={selectedTypes.includes(type)}
                />
              ))}
            </View>
          </View>

          {/* Tags card */}
          <View className="rounded-xl border border-border bg-card">
            <View className="gap-1 px-4 pt-4 pb-2">
              <Text className="font-semibold text-base text-foreground">
                <Trans>Tags</Trans>
              </Text>
              <Text className="text-muted-foreground text-sm">
                <Trans>Words with any of these tags will be included</Trans>
              </Text>
            </View>
            <View className="px-4 pt-2 pb-4">
              <TagsInput
                onChange={setTags}
                showRecentTags={false}
                value={tags}
              />
            </View>
          </View>

          {/* Danger Zone */}
          <View className="rounded-xl border border-destructive/20 bg-card">
            <View className="px-4 pt-4 pb-2">
              <Text className="font-semibold text-base text-foreground">
                <Trans>Danger Zone</Trans>
              </Text>
            </View>
            <View className="gap-4 px-4 pt-2 pb-4">
              <Text className="text-muted-foreground text-sm">
                <Trans>
                  Permanently delete this deck. Your words and flashcards will
                  not be affected.
                </Trans>
              </Text>
              <Button
                disabled={isDeleting}
                onPress={handleDelete}
                variant="destructive"
              >
                {isDeleting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Trans>Delete Deck</Trans>
                )}
              </Button>
            </View>
          </View>

          {/* Action row */}
          <View className="flex-row items-center justify-center gap-3 pt-2">
            <Button onPress={() => router.back()} variant="outline">
              <Trans>Cancel</Trans>
            </Button>
            <Button
              disabled={isUpdating || !name.trim()}
              onPress={handleSubmit}
              variant="default"
            >
              {isUpdating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Trans>Save</Trans>
              )}
            </Button>
          </View>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

const Breadcrumbs = () => {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2">
        <Pressable onPress={() => router.back()}>
          <Text className="text-muted-foreground text-sm">
            <Trans>Decks</Trans>
          </Text>
        </Pressable>
        <ChevronRight color={colors.mutedForeground} size={14} />
        <Text className="font-normal text-foreground text-sm">
          <Trans>Edit deck</Trans>
        </Text>
      </View>
    </View>
  );
};

const BackButton = () => {
  const router = useRouter();
  const locales = useLocales();
  const dir = locales[0].textDirection;
  const BackIcon = dir === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <Button
      Icon={BackIcon}
      onPress={() => router.back()}
      size="icon"
      variant="outline"
    />
  );
};

const TypeChip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
    >
      <Animated.View
        className={`rounded-full border px-3.5 py-2 ${
          selected
            ? "border-primary bg-primary/10"
            : "border-border bg-background"
        }`}
        style={animatedStyle}
      >
        <Text
          className={`text-sm ${
            selected ? "font-medium text-primary" : "text-muted-foreground"
          }`}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};
