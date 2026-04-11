import { t } from "@lingui/core/macro";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Input } from "@/components/ui/input";
import { useThemeColors } from "@/lib/theme";

interface TagsInputProps {
  value: { name: string }[] | undefined;
  onChange: (value: { name: string }[]) => void;
  onInputFocus?: () => void;
}

export const TagsInput = ({
  value,
  onChange,
  onInputFocus,
}: TagsInputProps) => {
  const colors = useThemeColors();
  const [tagInput, setTagInput] = useState("");

  const handleSubmit = () => {
    const text = tagInput.trim();
    if (text) {
      onChange([...(value || []), { name: text }]);
      setTagInput("");
    }
  };

  return (
    <View className="gap-3">
      {value && value.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {value.map((tag, index) => (
            <View
              className="flex-row items-center rounded-full bg-primary/10 px-3 py-1.5"
              key={index}
            >
              <Text className="text-primary text-sm">{tag.name}</Text>
              <Pressable
                className="ml-1.5"
                onPress={() => {
                  const newTags = value.filter((_, i) => i !== index);
                  onChange(newTags);
                }}
              >
                <X color={colors.primary} size={14} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Input
        onChangeText={setTagInput}
        onFocus={onInputFocus}
        onSubmitEditing={handleSubmit}
        placeholder={t`Add a tag and press enter`}
        returnKeyType="done"
        value={tagInput}
      />
    </View>
  );
};
