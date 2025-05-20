import { SafeAreaView } from "react-native-safe-area-context";
import { View, useColorScheme } from "react-native";
import { cn } from "@bahar/design-system";

export const Page: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaView
      style={{
        // TODO: Use bg-muted/40 when nativewind supports it
        backgroundColor: colorScheme === "dark" ? "#0c1625" : "#f9fbfd",
      }}
      className={cn("flex-1", className)}
    >
      <View className={cn("flex-1 px-8 flex-col gap-y-6 mt-12")}>
        {children}
      </View>
    </SafeAreaView>
  );
};
