import { useColorScheme, View } from "react-native";
import { cn } from "@bahar/design-system";

export const Page: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const colorScheme = useColorScheme();

  return (
    <View
      style={{
        // TODO: Use bg-muted/40 when nativewind supports it
        backgroundColor: colorScheme === "dark" ? "#0c1625" : "#f9fbfd",
      }}
      className={cn("flex-1 px-8 flex-col gap-y-6 pt-12 pb-safe", className)}
    >
      {children}
    </View>
  );
};
