import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { View, Text, useColorScheme } from "react-native";
import { Trans } from "@lingui/react/macro";
import { Pressable } from "react-native-gesture-handler";

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
      <View className="bg-black dark:bg-white border border-input w-full flex flex-row items-center gap-x-2 justify-center rounded-md transition-colors disabled:opacity-50 h-10 px-4 py-2">
        <FontAwesome5 name="github" size={18} color={iconColor} />

        <Text className="text-secondary font-medium">
          <Trans>GitHub</Trans>
        </Text>
      </View>
    </Pressable>
  );
};
