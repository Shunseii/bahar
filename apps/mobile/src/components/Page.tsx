import { View } from "react-native";
import { cn } from "@bahar/design-system";
import { useThemeColors } from "@/lib/theme";

export const Page: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const colors = useThemeColors();

  return (
    <View
      style={{
        backgroundColor: colors.muted,
      }}
      className={cn("flex-1 px-8 flex-col gap-y-6 pt-12 pb-safe", className)}
    >
      {children}
    </View>
  );
};
