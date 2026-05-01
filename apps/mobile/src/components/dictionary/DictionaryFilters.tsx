import { WORD_TYPES, type WordType } from "@bahar/drizzle-user-db-schemas";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import {
  ArrowDownUp,
  BookType,
  Check,
  ChevronDown,
  FunnelX,
  Lock,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react-native";
import { type FC, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import type { SortOption } from "@/hooks/useSearch";
import { useUserPlan } from "@/hooks/useUserPlan";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import {
  activeFilterCountAtom,
  selectedTagsAtom,
  selectedTypesAtom,
  sortOptionAtom,
} from "@/lib/store/filters";
import { useThemeColors } from "@/lib/theme";
import { Button } from "../ui/button";

const SORT_OPTIONS: SortOption[] = [
  "relevance",
  "updatedAt",
  "createdAt",
  "difficulty",
];

const useSortLabels = (): Record<SortOption, string> => {
  const { t } = useLingui();
  return {
    relevance: t`Relevance`,
    updatedAt: t`Recently updated`,
    createdAt: t`Recently added`,
    difficulty: t`Most difficult`,
  };
};

const useWordTypeLabels = (): Record<WordType, string> => {
  const { t } = useLingui();
  return {
    ism: t`Ism`,
    "fi'l": t`Fi'l`,
    harf: t`Harf`,
    expression: t`Expression`,
  };
};

const CollapsibleSection: FC<{
  icon: typeof Tag;
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  summary?: string;
  children: React.ReactNode;
}> = ({ icon: Icon, label, isExpanded, onToggle, summary, children }) => {
  const colors = useThemeColors();
  const chevronRotation = useSharedValue(isExpanded ? 180 : 0);

  useEffect(() => {
    chevronRotation.value = withTiming(isExpanded ? 180 : 0, { duration: 200 });
  }, [isExpanded]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  return (
    <View>
      <Pressable
        className="flex-row items-center gap-2 px-4 py-3 active:bg-muted/30"
        onPress={onToggle}
      >
        <Icon color={colors.mutedForeground} size={16} />
        <Text className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
          {label}
        </Text>
        <View className="h-px flex-1 bg-border/50" />
        <Animated.View style={chevronStyle}>
          <ChevronDown color={colors.mutedForeground} size={16} />
        </Animated.View>
      </Pressable>

      {isExpanded ? (
        <Animated.View entering={FadeIn.duration(200)}>
          {children}
        </Animated.View>
      ) : summary ? (
        <View className="px-4 pb-2">
          <Text className="text-muted-foreground text-sm">{summary}</Text>
        </View>
      ) : null}
    </View>
  );
};

const TAG_LIST_MAX_HEIGHT = 300;

const FiltersModal: FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const { t } = useLingui();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isFreeUser } = useUserPlan();
  const { formatNumber } = useFormatNumber();
  const sortLabels = useSortLabels();
  const wordTypeLabels = useWordTypeLabels();

  const appliedTags = useAtomValue(selectedTagsAtom);
  const appliedTypes = useAtomValue(selectedTypesAtom);
  const appliedSort = useAtomValue(sortOptionAtom);
  const setAppliedTags = useSetAtom(selectedTagsAtom);
  const setAppliedTypes = useSetAtom(selectedTypesAtom);
  const setAppliedSort = useSetAtom(sortOptionAtom);

  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftTypes, setDraftTypes] = useState<WordType[]>([]);
  const [draftSort, setDraftSort] = useState<SortOption>("relevance");
  const [tagSearch, setTagSearch] = useState("");
  const [expandedSection, setExpandedSection] = useState<
    "tags" | "types" | "sort" | null
  >("sort");

  // Sync draft state from applied state when modal opens
  useEffect(() => {
    if (visible) {
      setDraftTags(appliedTags);
      setDraftTypes(appliedTypes);
      setDraftSort(appliedSort);
      setTagSearch("");
      setExpandedSection("sort");
    }
  }, [visible]);

  const { data: availableTags } = useQuery({
    queryFn: () => dictionaryEntriesTable.tags.query(),
    ...dictionaryEntriesTable.tags.cacheOptions,
  });

  const filteredTags = availableTags?.filter(
    (item) =>
      !tagSearch.trim() ||
      item.tag.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const toggleTag = (tag: string) => {
    setDraftTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleType = (type: WordType) => {
    setDraftTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const clearAll = () => {
    setAppliedTags([]);
    setAppliedTypes([]);
    setAppliedSort("relevance");
    setDraftTags([]);
    setDraftTypes([]);
    setDraftSort("relevance");
  };

  const handleApply = () => {
    setAppliedTags(draftTags);
    setAppliedTypes(draftTypes);
    setAppliedSort(draftSort);
    onClose();
  };

  const hasAppliedFilters =
    appliedTags.length > 0 ||
    appliedTypes.length > 0 ||
    appliedSort !== "relevance";

  const hasDraftChanges =
    JSON.stringify(draftTags) !== JSON.stringify(appliedTags) ||
    JSON.stringify(draftTypes) !== JSON.stringify(appliedTypes) ||
    draftSort !== appliedSort;

  const tagsSummary =
    draftTags.length > 0
      ? t`${formatNumber(draftTags.length)} tags selected`
      : undefined;

  const typesSummary =
    draftTypes.length > 0
      ? draftTypes.map((type) => wordTypeLabels[type]).join(", ")
      : undefined;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
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
            <X color={colors.foreground} size={24} />
          </Pressable>
          <Text className="font-semibold text-foreground text-lg">
            <Trans>Filters</Trans>
          </Text>
          {hasAppliedFilters ? (
            <Pressable
              className="flex-row items-center gap-1.5 p-2"
              onPress={clearAll}
            >
              <FunnelX color={colors.primary} size={16} />
              <Text className="text-primary text-sm">
                <Trans>Clear all</Trans>
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        <ScrollView className="flex-1">
          {/* Tags section */}
          <CollapsibleSection
            icon={Tag}
            isExpanded={expandedSection === "tags"}
            label={t`Tags`}
            onToggle={() =>
              setExpandedSection((prev) => (prev === "tags" ? null : "tags"))
            }
            summary={tagsSummary}
          >
            <View className="px-4 pb-3">
              <TextInput
                className="rounded-lg bg-muted/40 px-3 py-2.5 text-foreground text-sm"
                onChangeText={setTagSearch}
                placeholder={t`Search tags...`}
                placeholderTextColor={colors.mutedForeground}
                value={tagSearch}
              />
            </View>

            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={{ maxHeight: TAG_LIST_MAX_HEIGHT }}
            >
              {filteredTags?.map(({ tag, count }) => {
                const isSelected = draftTags.includes(tag);
                return (
                  <Pressable
                    className="flex-row items-center justify-between px-4 py-3 active:bg-muted/30"
                    key={tag}
                    onPress={() => toggleTag(tag)}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className={`h-5.5 w-5.5 items-center justify-center rounded ${
                          isSelected
                            ? "bg-primary"
                            : "border border-border bg-background"
                        }`}
                      >
                        {isSelected && <Check color="#fff" size={14} />}
                      </View>
                      <Text
                        className={`text-base ${
                          isSelected
                            ? "font-medium text-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {tag}
                      </Text>
                    </View>
                    <Text className="text-muted-foreground text-sm">
                      {formatNumber(count)}
                    </Text>
                  </Pressable>
                );
              })}

              {filteredTags?.length === 0 && (
                <View className="px-4 py-6">
                  <Text className="text-center text-muted-foreground text-sm">
                    <Trans>No tags found</Trans>
                  </Text>
                </View>
              )}
            </ScrollView>
          </CollapsibleSection>

          {/* Word Types section */}
          <CollapsibleSection
            icon={BookType}
            isExpanded={expandedSection === "types"}
            label={t`Word types`}
            onToggle={() =>
              setExpandedSection((prev) => (prev === "types" ? null : "types"))
            }
            summary={typesSummary}
          >
            <View className="flex-row flex-wrap gap-2 px-4 pb-3">
              {WORD_TYPES.map((type) => {
                const isSelected = draftTypes.includes(type);
                return (
                  <Pressable
                    className={`rounded-full border px-3.5 py-2 ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    }`}
                    key={type}
                    onPress={() => toggleType(type)}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected
                          ? "font-medium text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {wordTypeLabels[type]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </CollapsibleSection>

          {/* Sort section */}
          <CollapsibleSection
            icon={ArrowDownUp}
            isExpanded={expandedSection === "sort"}
            label={t`Sort by`}
            onToggle={() =>
              setExpandedSection((prev) => (prev === "sort" ? null : "sort"))
            }
            summary={sortLabels[draftSort]}
          >
            {SORT_OPTIONS.map((option) => {
              const isActive = draftSort === option;
              const isProOnly = option === "difficulty";
              const isDisabled = isProOnly && isFreeUser;

              return (
                <Pressable
                  className="flex-row items-center justify-between px-4 py-3.5 active:bg-muted/30"
                  disabled={isDisabled}
                  key={option}
                  onPress={() => setDraftSort(option)}
                  style={isDisabled ? { opacity: 0.5 } : undefined}
                >
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`text-base ${
                        isActive
                          ? "font-medium text-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {sortLabels[option]}
                    </Text>
                    {isProOnly && isFreeUser && (
                      <View className="flex-row items-center gap-1.5">
                        <View className="rounded bg-primary/10 px-1.5 py-0.5">
                          <Text className="font-bold text-[10px] text-primary uppercase">
                            Pro
                          </Text>
                        </View>
                        <Lock color={colors.mutedForeground} size={14} />
                      </View>
                    )}
                  </View>
                  {isActive && <Check color={colors.primary} size={20} />}
                </Pressable>
              );
            })}
          </CollapsibleSection>
        </ScrollView>

        {/* Footer buttons */}
        <View className="flex-row gap-3 border-border border-t px-4 py-3">
          <View className="flex-1">
            <Button onPress={onClose} variant="outline">
              <Trans>Cancel</Trans>
            </Button>
          </View>
          <View className="flex-1">
            <Button disabled={!hasDraftChanges} onPress={handleApply}>
              <Trans>Apply</Trans>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const DictionaryFilters: FC = () => {
  const colors = useThemeColors();
  const { formatNumber } = useFormatNumber();
  const [showModal, setShowModal] = useState(false);
  const setSelectedTags = useSetAtom(selectedTagsAtom);
  const setSelectedTypes = useSetAtom(selectedTypesAtom);
  const setSortOption = useSetAtom(sortOptionAtom);
  const activeFilterCount = useAtomValue(activeFilterCountAtom);
  const hasActiveFilters = activeFilterCount > 0;

  const clearAll = () => {
    setSelectedTags([]);
    setSelectedTypes([]);
    setSortOption("relevance");
  };

  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        className="flex-row items-center gap-1.5 py-1 active:opacity-70"
        onPress={() => setShowModal(true)}
      >
        <SlidersHorizontal color={colors.mutedForeground} size={14} />
        <Text className="text-muted-foreground text-sm">
          <Trans>Filters</Trans>
        </Text>
        {hasActiveFilters && (
          <View className="h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1">
            <Text className="font-semibold text-[10px] text-primary-foreground">
              {formatNumber(activeFilterCount)}
            </Text>
          </View>
        )}
      </Pressable>

      {hasActiveFilters && (
        <Pressable
          className="flex-row items-center gap-1 py-1 active:opacity-70"
          onPress={clearAll}
        >
          <FunnelX color={colors.mutedForeground} size={14} />
          <Text className="text-muted-foreground text-xs">
            <Trans>Clear</Trans>
          </Text>
        </Pressable>
      )}

      <FiltersModal onClose={() => setShowModal(false)} visible={showModal} />
    </View>
  );
};
