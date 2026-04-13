import { cn } from "@bahar/design-system";
import { Check } from "lucide-react-native";
import { Pressable, type PressableProps } from "react-native";
import { useThemeColors } from "@/lib/theme";

interface CheckboxProps extends Omit<PressableProps, "children"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

export const Checkbox = ({
  checked,
  onCheckedChange,
  className,
  ...props
}: CheckboxProps) => {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className={cn(
        "h-5 w-5 items-center justify-center rounded border",
        checked ? "border-primary bg-primary" : "border-border bg-background",
        className
      )}
      hitSlop={4}
      onPress={() => onCheckedChange?.(!checked)}
      {...props}
    >
      {checked && <Check color={colors.primaryForeground} size={14} />}
    </Pressable>
  );
};
