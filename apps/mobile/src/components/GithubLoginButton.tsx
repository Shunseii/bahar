import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { Trans } from "@lingui/react/macro";
import { Pressable, Text, useColorScheme, View } from "react-native";

export const GithubLoginButton = () => {
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === "dark" ? "black" : "white";

  return (
    <Pressable
      onPress={() => {
        // TODO: Implement this
        console.log("GitHub login pressed");
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View className="flex h-10 w-full flex-row items-center justify-center gap-x-2 rounded-md border border-input bg-black px-4 py-2 transition-colors disabled:opacity-50 dark:bg-white">
        <FontAwesome5 color={iconColor} name="github" size={18} />

        <Text className="font-medium text-secondary">
          <Trans>GitHub</Trans>
        </Text>
      </View>
    </Pressable>
  );
};
