import { cn } from "@bahar/design-system";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Check, ChevronDown } from "lucide-react-native";
import { useCallback, useRef } from "react";
import { Pressable, Text, View } from "react-native";
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
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const handleOpen = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      bottomSheetRef.current?.dismiss();
    },
    [onChange]
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

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

      <BottomSheetModal
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.card }}
        enableDynamicSizing
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        ref={bottomSheetRef}
      >
        <BottomSheetView>
          {placeholder && (
            <View className="border-border border-b px-5 pb-3">
              <Text className="font-semibold text-[15px] text-foreground">
                {placeholder}
              </Text>
            </View>
          )}

          <View className="p-safe">
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
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};
