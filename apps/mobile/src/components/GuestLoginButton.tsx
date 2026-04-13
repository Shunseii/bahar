import { Trans } from "@lingui/react/macro";
import { User } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme";
import { authClient } from "@/utils/auth-client";

export const GuestLoginButton = () => {
  const { mutedForeground } = useThemeColors();

  return (
    <Pressable
      onPress={() => {
        authClient.signIn.anonymous();
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View className="flex h-10 w-full flex-row items-center justify-center gap-x-2 rounded-md border border-input bg-muted px-4 py-2">
        <User color={mutedForeground} size={16} />

        <Text className="font-medium text-muted-foreground">
          <Trans>Continue as Guest</Trans>
        </Text>
      </View>
    </Pressable>
  );
};
