import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { Trans } from "@lingui/react/macro";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme";
import { authClient } from "@/utils/auth-client";

export const GithubLoginButton = () => {
  const { primaryForeground } = useThemeColors();

  return (
    <Pressable
      onPress={() => {
        authClient.signIn.social({ provider: "github", callbackURL: "/" });
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View className="flex h-10 w-full flex-row items-center justify-center gap-x-2 rounded-md border border-input bg-foreground px-4 py-2 transition-colors disabled:opacity-50">
        <FontAwesome5 color={primaryForeground} name="github" size={18} />

        <Text className="font-medium text-primary-foreground">
          <Trans>Continue with GitHub</Trans>
        </Text>
      </View>
    </Pressable>
  );
};
