import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";
import { cn } from "@bahar/design-system";

export const Page: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className={cn("flex-1 px-8 flex-col gap-y-6 mt-12", className)}>
        {children}
      </View>
    </SafeAreaView>
  );
};
