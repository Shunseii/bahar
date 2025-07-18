import React from "react";
import { Text, View } from "react-native";
import { Page } from "@/components/Page";
import { Trans } from "@lingui/react/macro";

export default function AddWordScreen() {
  return (
    <Page className="pt-0 px-4">
      <View className="flex-1 pt-4">
        <Text className="text-muted-foreground mt-2 text-center text-sm mb-6">
          <Trans>Add a new word to your personal dictionary.</Trans>
        </Text>
        
        {/* TODO: Add word form will be implemented here */}
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted-foreground">
            <Trans>Word form coming soon...</Trans>
          </Text>
        </View>
      </View>
    </Page>
  );
}