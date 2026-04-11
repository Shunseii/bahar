import type { LucideProps } from "lucide-react-native";
import type { ComponentType } from "react";
import { useThemeColors } from "@/lib/theme";

type ThemeColorKey = keyof ReturnType<typeof useThemeColors>;

interface IconProps extends Omit<LucideProps, "color"> {
  icon: ComponentType<LucideProps>;
  themeColor?: ThemeColorKey;
  color?: string;
}

export function Icon({
  icon: IconComponent,
  themeColor,
  color,
  ...rest
}: IconProps) {
  const colors = useThemeColors();
  const resolvedColor =
    color ?? (themeColor ? colors[themeColor] : colors.foreground);
  return <IconComponent color={resolvedColor} {...rest} />;
}
