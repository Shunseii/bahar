import type { DeckFilters, WordType } from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { decksTable } from "@/lib/db/operations";
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

export default function CreateDeckScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { scrollHandler } = useCollapsibleHeader(t`Create a new deck`);
  const wordTypeLabels = useWordTypeLabels();

  const [name, setName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<WordType[]>([]);
  const [tags, setTags] = useState<{ name: string }[]>([]);

  const { mutateAsync: createDeck, isPending } = useMutation({
    mutationFn: decksTable.create.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
      toast.success(t`Deck created`);
      router.back();
    },
    onError: (error) => {
      toast.error(t`Failed to create deck`);
      console.error("Create deck error:", error);
    },
  });

  const handleSubmit = async () => {
    if (!name.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const filters: DeckFilters = {};
    if (selectedTypes.length > 0) filters.types = selectedTypes;
    if (tags.length > 0) filters.tags = tags.map((t) => t.name);

    await createDeck({ deck: { name: name.trim(), filters } });
  };

  const toggleType = (type: WordType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

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
              <Trans>Create a new deck</Trans>
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

          {/* Action row */}
          <View className="flex-row items-center justify-center gap-3 pt-2">
            <Button onPress={() => router.back()} variant="outline">
              <Trans>Cancel</Trans>
            </Button>
            <Button
              disabled={isPending || !name.trim()}
              onPress={handleSubmit}
              variant="default"
            >
              {isPending ? (
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
          <Trans>New deck</Trans>
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
