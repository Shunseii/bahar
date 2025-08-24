import { cn } from "@bahar/design-system";
import { Trans } from "@lingui/react/macro";
import { FC } from "react";
import { Text, View } from "react-native";
import { Pressable, PressableProps } from "react-native-gesture-handler";

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
          "items-center justify-center rounded-md transition-colors disabled:opacity-50 border border-input bg-background h-10 px-4 py-2 relative",
        )}
      >
        {showNotificationDot && (
          <View className="absolute border-background border-2 -top-1 -right-1 p-1 text-xs h-2.5 w-2.5 bg-red-500 rounded-full z-10" />
        )}

        <Text className={cn("text-center text-foreground text-sm font-medium")}>
          <Trans>Review flashcards</Trans>
        </Text>
      </View>
    </Pressable>
  );
};
