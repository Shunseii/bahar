/**
 * Dictionary entry card component.
 *
 * Displays a dictionary entry with expandable details.
 */

import { cn } from "@bahar/design-system";
import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronDown, Edit, Share2 } from "lucide-react-native";
import { type FC, memo, useEffect } from "react";
import { Pressable, Share, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme";

interface DictionaryEntryCardProps {
  entry: SelectDictionaryEntry;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  searchQuery?: string;
}

const useWordTypeLabels = (): Record<SelectDictionaryEntry["type"], string> => {
  const { t } = useLingui();
  return {
    ism: t`Noun`,
    "fi'l": t`Verb`,
    harf: t`Particle`,
    expression: t`Expression`,
  };
};

const useGenderLabels = (): Record<"masculine" | "feminine", string> => {
  const { t } = useLingui();
  return {
    masculine: t`Masculine`,
    feminine: t`Feminine`,
  };
};

const ShareButton: FC<{
  word: string;
  translation: string;
}> = ({ word, translation }) => {
  const colors = useThemeColors();
  const handleShare = async () => {
    try {
      await Share.share({
        message: `${word} - ${translation}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // User cancelled or error
    }
  };

  return (
    <Pressable
      className="rounded-md p-2 active:bg-primary/10"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={handleShare}
    >
      <Share2 color={colors.mutedForeground} size={18} />
    </Pressable>
  );
};

const ExpandedDetails: FC<{ entry: SelectDictionaryEntry }> = ({ entry }) => {
  const wordTypeLabels = useWordTypeLabels();
  const genderLabels = useGenderLabels();
  const hasDefinition = entry.definition;
  const hasRoot = entry.root && entry.root.length > 0;
  const hasTags = entry.tags && entry.tags.length > 0;
  const hasExamples = entry.examples && entry.examples.length > 0;
  const hasMorphology = entry.morphology;

  const ismMorphology = hasMorphology ? entry.morphology?.ism : null;
  const verbMorphology = hasMorphology ? entry.morphology?.verb : null;

  return (
    <Animated.View
      className="mt-3 border-border/50 border-t pt-3"
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(100)}
    >
      <View className="mb-3 flex-row flex-wrap items-center gap-2">
        <View className="rounded-md bg-primary/10 px-2 py-1">
          <Text className="font-medium text-primary text-sm">
            {wordTypeLabels[entry.type]}
          </Text>
        </View>
        {hasRoot && (
          <View className="rounded-md bg-muted px-2 py-1">
            <Text
              className="text-muted-foreground text-sm"
              style={{ writingDirection: "rtl" }}
            >
              {entry.root!.join("\u00A0\u2011\u00A0")}
            </Text>
          </View>
        )}
      </View>

      {hasDefinition && (
        <View className="mb-3">
          <Text className="mb-1 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Definition</Trans>
          </Text>
          <Text className="text-foreground/80 text-sm">{entry.definition}</Text>
        </View>
      )}

      {ismMorphology && (
        <View className="mb-3">
          <Text className="mb-2 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Morphology</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {ismMorphology.singular && (
              <View>
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Singular</Trans>
                </Text>
                <Text
                  className="text-base text-foreground/80"
                  style={{ writingDirection: "rtl" }}
                >
                  {ismMorphology.singular}
                </Text>
              </View>
            )}
            {ismMorphology.dual && (
              <View>
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Dual</Trans>
                </Text>
                <Text
                  className="text-base text-foreground/80"
                  style={{ writingDirection: "rtl" }}
                >
                  {ismMorphology.dual}
                </Text>
              </View>
            )}
            {ismMorphology.plurals && ismMorphology.plurals.length > 0 && (
              <View>
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Plural</Trans>
                </Text>
                <Text
                  className="text-base text-foreground/80"
                  style={{ writingDirection: "rtl" }}
                >
                  {ismMorphology.plurals.map((p) => p.word).join("، ")}
                </Text>
              </View>
            )}
            {ismMorphology.gender && (
              <View>
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Gender</Trans>
                </Text>
                <Text className="text-foreground/80">
                  {genderLabels[ismMorphology.gender]}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {verbMorphology && (
        <View className="mb-3">
          <Text className="mb-2 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Morphology</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {verbMorphology.past_tense && (
              <View>
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Past</Trans>
                </Text>
                <Text
                  className="text-base text-foreground/80"
                  style={{ writingDirection: "rtl" }}
                >
                  {verbMorphology.past_tense}
                </Text>
              </View>
            )}
            {verbMorphology.present_tense && (
              <View>
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Present</Trans>
                </Text>
                <Text
                  className="text-base text-foreground/80"
                  style={{ writingDirection: "rtl" }}
                >
                  {verbMorphology.present_tense}
                </Text>
              </View>
            )}
            {verbMorphology.imperative && (
              <View>
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Imperative</Trans>
                </Text>
                <Text
                  className="text-base text-foreground/80"
                  style={{ writingDirection: "rtl" }}
                >
                  {verbMorphology.imperative}
                </Text>
              </View>
            )}
            {verbMorphology.form && (
              <View>
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Form</Trans>
                </Text>
                <Text className="text-foreground/80">
                  {verbMorphology.form}
                  {verbMorphology.form_arabic &&
                    ` (${verbMorphology.form_arabic})`}
                </Text>
              </View>
            )}
            {verbMorphology.masadir && verbMorphology.masadir.length > 0 && (
              <View className="w-full">
                <Text className="text-muted-foreground/70 text-xs">
                  <Trans>Verbal nouns</Trans>
                </Text>
                <Text
                  className="text-base text-foreground/80"
                  style={{ writingDirection: "rtl" }}
                >
                  {verbMorphology.masadir.map((m) => m.word).join("، ")}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {hasExamples && (
        <View className="mb-3">
          <Text className="mb-2 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Examples</Trans>
          </Text>
          <View className="gap-2">
            {entry.examples!.slice(0, 2).map((example, i) => (
              <View
                className="rounded-lg border border-border/30 bg-muted/30 p-3"
                key={i}
              >
                <Text
                  className="text-base text-foreground/90"
                  style={{ writingDirection: "rtl" }}
                >
                  {example.sentence}
                </Text>
                {example.translation && (
                  <Text className="mt-1 text-muted-foreground text-sm">
                    {example.translation}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {hasTags && (
        <View>
          <Text className="mb-2 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Tags</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {entry.tags!.map((tag) => (
              <View className="rounded-full bg-muted px-2 py-1" key={tag}>
                <Text className="text-muted-foreground text-xs">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
};

export const DictionaryEntryCard: FC<DictionaryEntryCardProps> = memo(
  ({ entry, isExpanded, onToggleExpand }) => {
    const router = useRouter();
    const colors = useThemeColors();
    const rotation = useSharedValue(isExpanded ? 180 : 0);

    useEffect(() => {
      rotation.value = withTiming(isExpanded ? 180 : 0, { duration: 200 });
    }, [isExpanded]);

    const hasExpandableContent =
      entry.definition ||
      (entry.root && entry.root.length > 0) ||
      (entry.tags && entry.tags.length > 0) ||
      (entry.examples && entry.examples.length > 0) ||
      entry.morphology;

    const toggleExpanded = () => {
      Haptics.selectionAsync();
      onToggleExpand(entry.id);
    };

    const chevronStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotation.value}deg` }],
    }));

    return (
      <Pressable onPress={toggleExpanded}>
        <View
          className={cn(
            "rounded-xl border border-border/50 bg-card p-4",
            isExpanded && "border-primary/30"
          )}
        >
          <View className="flex-row items-start justify-between">
            <View className="mr-2 flex-1">
              <Text
                className="font-semibold text-2xl text-foreground"
                style={{ writingDirection: "rtl", textAlign: "left" }}
              >
                {entry.word}
              </Text>
              <Text className="mt-1 text-base text-muted-foreground">
                {entry.translation}
              </Text>
            </View>

            {/* Actions */}
            <View className="flex-row items-center">
              <ShareButton translation={entry.translation} word={entry.word} />
              <Pressable
                className="rounded-md p-2 active:bg-primary/10"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() =>
                  router.push(`/(search)/(home)/edit-word/${entry.id}`)
                }
              >
                <Edit color={colors.mutedForeground} size={18} />
              </Pressable>
              {hasExpandableContent && (
                <Animated.View style={chevronStyle}>
                  <ChevronDown color={colors.mutedForeground} size={18} />
                </Animated.View>
              )}
            </View>
          </View>

          {isExpanded && hasExpandableContent && (
            <ExpandedDetails entry={entry} />
          )}
        </View>
      </Pressable>
    );
  }
);
