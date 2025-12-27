import { cn } from "@bahar/design-system";
import { Trans } from "@lingui/react/macro";
import type { FC } from "react";
import { Pressable, type PressableProps, Text, View } from "react-native";

interface ButtonProps extends PressableProps {
  onPress: () => void;
  className?: string;
  showNotificationDot?: boolean;
}

export const ReviewFlashCardsButton: FC<ButtonProps> = ({
  onPress,
  className,
  showNotificationDot = false,
  ...rest
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
      {...rest}
    >
      <View
        className={cn(
          "relative h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 transition-colors disabled:opacity-50"
        )}
      >
        {showNotificationDot && (
          <View className="absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full border-2 border-background bg-red-500 p-1 text-xs" />
        )}

        <Text className={cn("text-center font-medium text-foreground text-sm")}>
          <Trans>Review flashcards</Trans>
        </Text>
      </View>
    </Pressable>
  );
};
