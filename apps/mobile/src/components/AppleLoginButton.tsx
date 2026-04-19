import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { Trans } from "@lingui/react/macro";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme";
import { authClient } from "@/utils/auth-client";

export const AppleLoginButton = () => {
  const { foreground } = useThemeColors();

  return (
    <Pressable
      onPress={() => {
        authClient.signIn.social({ provider: "apple", callbackURL: "/" });
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View className="flex h-10 w-full flex-row items-center justify-center gap-x-2 rounded-md border border-black bg-white px-4 py-2 transition-colors disabled:opacity-50 dark:border-white dark:bg-black">
        <FontAwesome5 color={foreground} name="apple" size={18} />

        <Text className="font-medium text-foreground">
          <Trans>Continue with Apple</Trans>
        </Text>
      </View>
    </Pressable>
  );
};
