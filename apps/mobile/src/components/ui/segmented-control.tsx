import { cn } from "@bahar/design-system";
import type { FC } from "react";
import { Pressable, Text, View } from "react-native";

type SegmentedOption = { value: string; label: string };

/**
 * iOS-style segmented control: a muted track with a solid pill on the active
 * segment, so the selected option reads clearly. Mobile counterpart of the
 * web-ui SegmentedControl.
 */
export const SegmentedControl: FC<{
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedOption[];
  disabled?: boolean;
}> = ({ value, onValueChange, options, disabled }) => (
  <View className="flex-row rounded-lg bg-muted p-0.5">
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <Pressable
          className={cn("rounded-md px-4 py-1.5", active && "bg-background")}
          disabled={disabled}
          key={opt.value}
          onPress={() => onValueChange(opt.value)}
        >
          <Text
            className={cn(
              "font-medium text-xs",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {opt.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);
