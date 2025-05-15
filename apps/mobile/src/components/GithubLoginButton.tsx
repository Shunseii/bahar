import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { Button } from "./ui/button";
import { View, Text, useColorScheme } from "react-native";
import { Trans } from "@lingui/react/macro";

export const GithubLoginButton = () => {
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === "dark" ? "black" : "white";

  return (
    <Button
      variant="secondary"
      className="bg-black dark:bg-white"
      onPress={() => {
        console.log("GitHub login pressed");
      }}
    >
      <View className="flex-row items-center justify-center w-full gap-x-2">
        <FontAwesome5 name="github" size={20} color={iconColor} />

        <Text className="text-secondary font-medium">
          <Trans>GitHub</Trans>
        </Text>
      </View>
    </Button>
  );
};
