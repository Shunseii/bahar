import React from "react";
import { Text } from "react-native";
import { Page } from "@/components/Page";

export default function DecksScreen() {
  return (
    <Page>
      <Text className="tracking-tight font-bold text-2xl text-foreground text-center">
        Decks
      </Text>

      <Text className="text-muted-foreground mt-2 text-center text-sm">
        Add words to get started.
      </Text>
    </Page>
  );
}
