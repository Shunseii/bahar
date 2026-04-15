import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme";

interface ScreenHeaderProps {
  icon: LucideIcon;
  title: string;
  right?: React.ReactNode;
}

export const ScreenHeader = ({ icon: Icon, title, right }: ScreenHeaderProps) => {
  const colors = useThemeColors();

  return (
    <View className="border-border border-b px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="rounded-xl bg-primary/10 p-2">
            <Icon color={colors.primary} size={24} />
          </View>
          <Text className="font-bold text-2xl text-foreground">{title}</Text>
        </View>
        {right}
      </View>
    </View>
  );
};
