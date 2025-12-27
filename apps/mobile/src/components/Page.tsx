import { cn } from "@bahar/design-system";
import { View } from "react-native";
import { useThemeColors } from "@/lib/theme";

export const Page: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const colors = useThemeColors();

  return (
    <View
      className={cn("flex-1 flex-col gap-y-6 px-8 pt-12 pb-safe", className)}
      style={{
        backgroundColor: colors.muted,
      }}
    >
      {children}
    </View>
  );
};
