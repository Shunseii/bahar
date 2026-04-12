import { cn } from "@bahar/design-system";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { Check, Plus, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { recentTagsAtom } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

interface TagsInputProps {
  value: { name: string }[] | undefined;
  onChange: (value: { name: string }[]) => void;
}

export const TagsInput = ({ value, onChange }: TagsInputProps) => {
  const colors = useThemeColors();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: allTags } = useQuery({
    queryFn: dictionaryEntriesTable.tags.query,
    ...dictionaryEntriesTable.tags.cacheOptions,
  });

  const storedRecentTags = useAtomValue(recentTagsAtom);

  const selectedNames = useMemo(
    () => new Set(value?.map((t) => t.name) ?? []),
    [value]
  );

  const recentTags = useMemo(
    () => (storedRecentTags ?? []).filter((tag) => !selectedNames.has(tag)),
    [storedRecentTags, selectedNames]
  );

  const addTag = (name: string) => {
    if (!selectedNames.has(name)) {
      onChange([...(value || []), { name }]);
    }
  };

  const removeTag = (index: number) => {
    onChange((value || []).filter((_, i) => i !== index));
  };

  return (
    <View className="gap-3">
      {value && value.length > 0 && (
        <View>
          <Text className="mb-2 font-medium text-muted-foreground text-xs">
            <Trans>Selected</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {value.map((tag, index) => (
              <Pressable key={tag.name} onPress={() => removeTag(index)}>
                <View className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5">
                  <Text className="text-foreground text-sm">{tag.name}</Text>
                  <X color={colors.foreground} size={14} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {recentTags.length > 0 && (
        <View>
          <Text className="mb-2 font-medium text-muted-foreground text-xs">
            <Trans>Recently used</Trans>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {recentTags.map((tag) => (
              <Pressable key={tag} onPress={() => addTag(tag)}>
                <View className="rounded-full border border-border bg-muted/30 px-3 py-1.5">
                  <Text className="text-muted-foreground text-sm">{tag}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Browse button */}
      <Pressable onPress={() => setModalOpen(true)}>
        <View className="h-10 flex-row items-center justify-center gap-2 rounded-lg border border-border">
          <Search color={colors.mutedForeground} size={16} />
          <Text className="text-muted-foreground text-sm">
            <Trans>Browse all tags...</Trans>
          </Text>
        </View>
      </Pressable>

      {/* Full screen modal */}
      <TagsModal
        allTags={allTags ?? []}
        onAdd={addTag}
        onClose={() => setModalOpen(false)}
        onRemove={(name) => {
          const idx = (value || []).findIndex((t) => t.name === name);
          if (idx >= 0) removeTag(idx);
        }}
        selectedNames={selectedNames}
        visible={modalOpen}
      />
    </View>
  );
};

const TagsModal = ({
  visible,
  onClose,
  allTags,
  selectedNames,
  onAdd,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  allTags: { tag: string; count: number }[];
  selectedNames: Set<string>;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.tag.toLowerCase().includes(q));
  }, [allTags, search]);

  const exactMatch = useMemo(
    () =>
      search.trim() &&
      allTags.some((t) => t.tag.toLowerCase() === search.trim().toLowerCase()),
    [allTags, search]
  );

  const handleToggle = (tag: string) => {
    if (selectedNames.has(tag)) {
      onRemove(tag);
    } else {
      onAdd(tag);
    }
  };

  const handleCreate = () => {
    const name = search.trim();
    if (name && !selectedNames.has(name)) {
      onAdd(name);
      setSearch("");
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {/* Header */}
        <View className="h-14 flex-row items-center justify-between border-border border-b px-4">
          <Pressable hitSlop={8} onPress={onClose}>
            <X color={colors.foreground} size={24} />
          </Pressable>
          <Text className="font-semibold text-base text-foreground">
            <Trans>Select Tags</Trans>
          </Text>
          <Pressable hitSlop={8} onPress={onClose}>
            <Text className="font-semibold text-primary text-sm">
              <Trans>Done</Trans>
            </Text>
          </Pressable>
        </View>

        {/* Selected pills */}
        {selectedNames.size > 0 && (
          <View className="flex-row flex-wrap gap-2 border-border border-b px-4 py-3">
            {Array.from(selectedNames).map((name) => (
              <Pressable key={name} onPress={() => onRemove(name)}>
                <View className="flex-row items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
                  <Text className="text-primary text-sm">{name}</Text>
                  <X color={colors.primary} size={14} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Search */}
        <View className="px-4 py-3">
          <View className="h-11 flex-row items-center gap-2 rounded-lg border border-border bg-muted/20 px-3">
            <Search color={colors.mutedForeground} size={16} />
            <TextInput
              autoFocus
              className="color-foreground flex-1 text-foreground text-sm"
              onChangeText={setSearch}
              placeholder={t`Search tags...`}
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              value={search}
            />
            {search.length > 0 && (
              <Pressable hitSlop={8} onPress={() => setSearch("")}>
                <X color={colors.mutedForeground} size={16} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Tag list */}
        <FlatList
          data={filtered}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.tag}
          ListFooterComponent={
            search.trim() && !exactMatch ? (
              <Pressable onPress={handleCreate}>
                <View className="flex-row items-center gap-3 px-4 py-3">
                  <Plus color={colors.primary} size={16} />
                  <Text className="font-medium text-primary text-sm">
                    <Trans>Create "{search.trim()}"</Trans>
                  </Text>
                </View>
              </Pressable>
            ) : null
          }
          ListHeaderComponent={
            <View className="px-4 pb-2">
              <Text className="font-medium text-muted-foreground text-xs">
                {search.trim() ? (
                  <Trans>Matching tags</Trans>
                ) : (
                  <Trans>All tags</Trans>
                )}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedNames.has(item.tag);
            return (
              <Pressable onPress={() => handleToggle(item.tag)}>
                <View className="flex-row items-center gap-3 px-4 py-3">
                  <View
                    className={cn(
                      "h-5 w-5 items-center justify-center rounded",
                      isSelected ? "bg-primary" : "border-1.5 border-border"
                    )}
                  >
                    {isSelected && (
                      <Check color={colors.primaryForeground} size={14} />
                    )}
                  </View>
                  <Text
                    className={cn(
                      "flex-1 text-sm",
                      isSelected
                        ? "font-medium text-primary"
                        : "text-foreground"
                    )}
                  >
                    {item.tag}
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    <Trans>{item.count}x</Trans>
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
};
