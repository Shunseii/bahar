/**
 * Dictionary entry card component.
 *
 * Displays a dictionary entry with expandable details.
 */

import { FC, useState, memo } from "react";
import { View, Text, Pressable, Share } from "react-native";
import { useRouter } from "expo-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChevronDown, Edit, Share2 } from "lucide-react-native";
import { cn } from "@bahar/design-system";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme";
import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";

interface DictionaryEntryCardProps {
  entry: SelectDictionaryEntry;
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

const ShareButton: FC<{ word: string; translation: string; iconColor: string }> = ({
  word,
  translation,
  iconColor,
}) => {
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
      onPress={handleShare}
      className="p-2 rounded-md active:bg-primary/10"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Share2 size={18} color={iconColor} />
    </Pressable>
  );
};

const ExpandedDetails: FC<{ entry: SelectDictionaryEntry }> = ({ entry }) => {
  const wordTypeLabels = useWordTypeLabels();
  const hasDefinition = entry.definition;
  const hasRoot = entry.root && entry.root.length > 0;
  const hasTags = entry.tags && entry.tags.length > 0;
  const hasExamples = entry.examples && entry.examples.length > 0;
  const hasMorphology = entry.morphology;

  const ismMorphology = hasMorphology ? entry.morphology?.ism : null;
  const verbMorphology = hasMorphology ? entry.morphology?.verb : null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(100)}
      className="pt-3 mt-3 border-t border-border/50"
    >
      {/* Type and Root row */}
      <View className="flex-row flex-wrap items-center gap-2 mb-3">
        <View className="px-2 py-1 rounded-md bg-primary/10">
          <Text className="text-primary text-sm font-medium">
            {wordTypeLabels[entry.type]}
          </Text>
        </View>
        {hasRoot && (
          <View className="px-2 py-1 rounded-md bg-muted">
            <Text className="text-muted-foreground text-sm" style={{ writingDirection: "rtl" }}>
              {entry.root!.join(" - ")}
            </Text>
          </View>
        )}
      </View>

      {/* Definition */}
      {hasDefinition && (
        <View className="mb-3">
          <Text className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-1">
            <Trans>Definition</Trans>
          </Text>
          <Text className="text-sm text-foreground/80">{entry.definition}</Text>
        </View>
      )}

      {/* Ism Morphology */}
      {ismMorphology && (
        <View className="mb-3">
          <Text className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
            <Trans>Morphology</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {ismMorphology.singular && (
              <View>
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Singular</Trans>
                </Text>
                <Text className="text-base text-foreground/80" style={{ writingDirection: "rtl" }}>
                  {ismMorphology.singular}
                </Text>
              </View>
            )}
            {ismMorphology.dual && (
              <View>
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Dual</Trans>
                </Text>
                <Text className="text-base text-foreground/80" style={{ writingDirection: "rtl" }}>
                  {ismMorphology.dual}
                </Text>
              </View>
            )}
            {ismMorphology.plurals && ismMorphology.plurals.length > 0 && (
              <View>
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Plural</Trans>
                </Text>
                <Text className="text-base text-foreground/80" style={{ writingDirection: "rtl" }}>
                  {ismMorphology.plurals.map((p) => p.word).join("، ")}
                </Text>
              </View>
            )}
            {ismMorphology.gender && (
              <View>
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Gender</Trans>
                </Text>
                <Text className="text-foreground/80 capitalize">{ismMorphology.gender}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Verb Morphology */}
      {verbMorphology && (
        <View className="mb-3">
          <Text className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
            <Trans>Morphology</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {verbMorphology.past_tense && (
              <View>
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Past</Trans>
                </Text>
                <Text className="text-base text-foreground/80" style={{ writingDirection: "rtl" }}>
                  {verbMorphology.past_tense}
                </Text>
              </View>
            )}
            {verbMorphology.present_tense && (
              <View>
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Present</Trans>
                </Text>
                <Text className="text-base text-foreground/80" style={{ writingDirection: "rtl" }}>
                  {verbMorphology.present_tense}
                </Text>
              </View>
            )}
            {verbMorphology.imperative && (
              <View>
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Imperative</Trans>
                </Text>
                <Text className="text-base text-foreground/80" style={{ writingDirection: "rtl" }}>
                  {verbMorphology.imperative}
                </Text>
              </View>
            )}
            {verbMorphology.form && (
              <View>
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Form</Trans>
                </Text>
                <Text className="text-foreground/80">
                  {verbMorphology.form}
                  {verbMorphology.form_arabic && ` (${verbMorphology.form_arabic})`}
                </Text>
              </View>
            )}
            {verbMorphology.masadir && verbMorphology.masadir.length > 0 && (
              <View className="w-full">
                <Text className="text-xs text-muted-foreground/70">
                  <Trans>Verbal nouns</Trans>
                </Text>
                <Text className="text-base text-foreground/80" style={{ writingDirection: "rtl" }}>
                  {verbMorphology.masadir.map((m) => m.word).join("، ")}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Examples */}
      {hasExamples && (
        <View className="mb-3">
          <Text className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
            <Trans>Examples</Trans>
          </Text>
          <View className="gap-2">
            {entry.examples!.slice(0, 2).map((example, i) => (
              <View key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                <Text className="text-base text-foreground/90" style={{ writingDirection: "rtl" }}>
                  {example.sentence}
                </Text>
                {example.translation && (
                  <Text className="text-sm text-muted-foreground mt-1">
                    {example.translation}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tags */}
      {hasTags && (
        <View>
          <Text className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
            <Trans>Tags</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {entry.tags!.map((tag) => (
              <View key={tag} className="px-2 py-1 rounded-full bg-muted">
                <Text className="text-xs text-muted-foreground">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
};

export const DictionaryEntryCard: FC<DictionaryEntryCardProps> = memo(({ entry }) => {
  const router = useRouter();
  const colors = useThemeColors();
  const [isExpanded, setIsExpanded] = useState(false);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  // Icon color from theme
  const iconColor = colors.mutedForeground;

  const hasExpandableContent =
    entry.definition ||
    (entry.root && entry.root.length > 0) ||
    (entry.tags && entry.tags.length > 0) ||
    (entry.examples && entry.examples.length > 0) ||
    entry.morphology;

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    pressed.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    pressed.value = withSpring(0, { damping: 15, stiffness: 400 });
  };

  const toggleExpanded = () => {
    Haptics.selectionAsync();
    setIsExpanded(!isExpanded);
    rotation.value = withSpring(isExpanded ? 0 : 180, {
      damping: 15,
      stiffness: 200,
    });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      pressed.value,
      [0, 1],
      [0.08, 0.15],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      pressed.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale: scale.value }, { translateY }],
      shadowOpacity,
    };
  });

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={toggleExpanded}>
      <Animated.View
        layout={LinearTransition.springify().damping(18).stiffness(180)}
        style={[
          cardAnimatedStyle,
          {
            shadowColor: colors.foreground,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 4,
          },
        ]}
        className={cn(
          "p-4 rounded-xl bg-card border border-border/50",
          isExpanded && "border-primary/30",
        )}
      >
        <View className="flex-row justify-between items-start">
          {/* Word and Translation */}
          <View className="flex-1 mr-2">
            <Text
              className="text-2xl font-semibold text-foreground"
              style={{ writingDirection: "rtl", textAlign: "left" }}
            >
              {entry.word}
            </Text>
            <Text className="text-base text-muted-foreground mt-1">
              {entry.translation}
            </Text>
          </View>

          {/* Actions */}
          <View className="flex-row items-center">
            <ShareButton word={entry.word} translation={entry.translation} iconColor={iconColor} />
            <Pressable
              onPress={() => router.push(`/(search)/(home)/edit-word/${entry.id}`)}
              className="p-2 rounded-md active:bg-primary/10"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Edit size={18} color={iconColor} />
            </Pressable>
            {hasExpandableContent && (
              <Animated.View style={chevronStyle}>
                <ChevronDown size={18} color={iconColor} />
              </Animated.View>
            )}
          </View>
        </View>

        {/* Expanded Details */}
        {isExpanded && hasExpandableContent && <ExpandedDetails entry={entry} />}
      </Animated.View>
    </Pressable>
  );
});
