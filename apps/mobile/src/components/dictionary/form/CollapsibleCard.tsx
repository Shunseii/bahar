import { ChevronDown } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Card } from "@/components/ui/card";
import { useThemeColors } from "@/lib/theme";

interface CollapsibleCardProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

export const CollapsibleCard = ({
  title,
  defaultOpen = true,
  children,
  badge,
}: CollapsibleCardProps) => {
  const colors = useThemeColors();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const rotation = useSharedValue(defaultOpen ? 180 : 0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    rotation.value = withTiming(next ? 180 : 0, { duration: 200 });
  };

  return (
    <Card>
      <Pressable
        className="flex-row items-center justify-between p-4"
        onPress={toggleOpen}
      >
        <View className="flex-row items-center gap-2">
          <Text className="font-semibold text-base text-foreground">
            {title}
          </Text>
          {badge}
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown color={colors.mutedForeground} size={18} />
        </Animated.View>
      </Pressable>
      {isOpen && <View className="px-4 pb-4">{children}</View>}
    </Card>
  );
};
