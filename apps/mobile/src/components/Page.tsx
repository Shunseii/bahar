import { cn } from "@bahar/design-system";
import { View } from "react-native";

export const Page: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <View
      className={cn(
        "flex-1 flex-col gap-y-6 bg-background px-8 pt-12 pb-safe",
        className
      )}
    >
      {children}
    </View>
  );
};
