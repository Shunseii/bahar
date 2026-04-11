import { Trans } from "@lingui/react/macro";
import { Picker } from "@react-native-picker/picker";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/theme";

interface FormSelectProps {
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const FormSelect = ({
  options,
  value,
  onChange,
  placeholder,
}: FormSelectProps) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const handleOpen = () => {
    setTempValue(value);
    setIsOpen(true);
  };

  const handleDone = () => {
    if (tempValue) {
      onChange(tempValue);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-lg border border-input bg-background px-3 py-2.5"
        onPress={handleOpen}
      >
        <Text
          className={
            selectedLabel ? "text-foreground" : "text-muted-foreground"
          }
        >
          {selectedLabel ?? placeholder}
        </Text>
        <ChevronDown color={colors.mutedForeground} size={16} />
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={handleCancel}
        transparent
        visible={isOpen}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="flex-1"
            onPress={handleCancel}
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          />
          <View
            style={{
              backgroundColor: colors.card,
              paddingBottom: insets.bottom,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }}
          >
            <View className="flex-row items-center justify-between border-border border-b px-4 py-3">
              <Pressable onPress={handleCancel}>
                <Text className="text-base text-muted-foreground">
                  <Trans>Cancel</Trans>
                </Text>
              </Pressable>
              <Pressable onPress={handleDone}>
                <Text className="font-medium text-base text-primary">
                  <Trans>Done</Trans>
                </Text>
              </Pressable>
            </View>
            <Picker
              onValueChange={(itemValue) => {
                if (itemValue) {
                  setTempValue(itemValue);
                }
              }}
              selectedValue={tempValue}
            >
              {options.map((option) => (
                <Picker.Item
                  color={colors.foreground}
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </View>
  );
};
