import { View, TextInput, Pressable, Text } from "react-native";
import { useState } from "react";
import { Stack } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { Button } from "@/components/ui/button";

import { ThemedText } from "@/components/ThemedText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Page } from "@/components/Page";
import { Input } from "@/components/ui/input";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [showOTPForm, setShowOTPForm] = useState(false);

  const handleSubmit = () => {
    // To be implemented later
    setShowOTPForm(true);
  };

  // if (showOTPForm) {
  //   return (
  //     <SafeAreaView className="flex-1 p-6 justify-center">
  //       <Stack.Screen options={{ title: "Enter Code" }} />
  //       {/* OTP Form to be implemented */}
  //       <ThemedText type="title">Enter the code sent to your email</ThemedText>
  //     </SafeAreaView>
  //   );
  // }

  return (
    <Page className="flex flex-col gap-y-6 mt-12">
      <Text className="tracking-tight font-bold text-2xl text-foreground text-center">
        <Trans>Welcome to Bahar!</Trans>
      </Text>

      <Text className="text-muted-foreground mt-2 text-center text-sm">
        <Trans>Log in to your existing account or sign up for a new one</Trans>
      </Text>

      <View className="w-full gap-y-2 mb-6">
        <Text className="flex flex-col gap-y-4 w-full text-foreground">
          <Trans>Email</Trans>
        </Text>

        <Input
          value={email}
          onChangeText={(text) => setEmail(text)}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text className="text-sm text-muted-foreground">
          <Trans>This is case insensitive.</Trans>
        </Text>
      </View>

      <Button onPress={handleSubmit}>
        <Trans>Continue with Email</Trans>
      </Button>

      <View className="flex-row items-center my-6">
        <View className="flex-1 h-[1px] bg-gray-300 dark:bg-gray-700" />
        <Text className="mx-4 text-sm text-gray-500 dark:text-gray-400">
          <Trans>Or continue with</Trans>
        </Text>
        <View className="flex-1 h-[1px] bg-gray-300 dark:bg-gray-700" />
      </View>

      <Pressable
        className="bg-gray-100 dark:bg-gray-800 rounded-md py-3 items-center"
        onPress={() => {
          /* To be implemented */
        }}
      >
        <Text className="font-medium">
          <Trans>GitHub</Trans>
        </Text>
      </Pressable>
    </Page>
  );
}
