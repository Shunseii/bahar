import { cn } from "@bahar/design-system";
import { Check, ChevronDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
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
  const [isClosing, setIsClosing] = useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const handleClose = () => {
    setIsClosing(true);
  };

  useEffect(() => {
    if (isClosing) {
      const timeout = setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [isClosing]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    handleClose();
  };

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-lg border border-input bg-background px-3 py-2.5"
        onPress={() => setIsOpen(true)}
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
        animationType="fade"
        onRequestClose={handleClose}
        transparent
        visible={isOpen}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="flex-1"
            onPress={handleClose}
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          />
          <Animated.View
            entering={SlideInDown.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={{
              backgroundColor: colors.card,
              paddingBottom: insets.bottom,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }}
          >
            <View className="items-center py-3">
              <View className="h-1 w-9 rounded-full bg-border" />
            </View>

            {placeholder && (
              <View className="border-border border-b px-5 pb-3">
                <Text className="font-semibold text-[15px] text-foreground">
                  {placeholder}
                </Text>
              </View>
            )}

            <View>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    className={cn(
                      "flex-row items-center justify-between px-5 py-3.5",
                      isSelected && "bg-primary/8"
                    )}
                    key={option.value}
                    onPress={() => handleSelect(option.value)}
                  >
                    <Text
                      className={cn(
                        "text-[15px]",
                        isSelected
                          ? "font-medium text-primary"
                          : "text-foreground"
                      )}
                    >
                      {option.label}
                    </Text>
                    {isSelected && <Check color={colors.primary} size={20} />}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};
