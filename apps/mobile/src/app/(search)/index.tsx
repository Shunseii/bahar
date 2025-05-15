import React from "react";
import { Text } from "react-native";
import { Page } from "@/components/Page";
import { authClient } from "@/utils/auth-client";
import { Redirect } from "expo-router";

export default function HomeScreen() {
  const { data } = authClient.useSession();

  if (!data) {
    return <Redirect href={"/login"} />;
  }

  return (
    <Page>
      <Text className="tracking-tight font-bold text-2xl text-foreground text-center">
        hello!!
      </Text>

      <Text className="text-muted-foreground mt-2 text-center text-sm">
        PLEASE
      </Text>
    </Page>
  );
}
