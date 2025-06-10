import React from "react";
import { Text, View } from "react-native";
import { Page } from "@/components/Page";
import { InfiniteHits } from "@/components/meili/InfiniteHits";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react-native";
import { Trans } from "@lingui/react/macro";
import { ReviewFlashCardsButton } from "@/components/ReviewFlashcardsButton";

export default function HomeScreen() {
  return (
    <Page className="pt-0 px-0">
      <View className="flex flex-row justify-between mx-4 mt-4 mb-2">
        <Button
          variant="outline"
          onPress={() => {}}
          className="h-max"
          Icon={PlusIcon}
        >
          <Trans>Add word</Trans>
        </Button>

        <ReviewFlashCardsButton onPress={() => {}} />
      </View>

      <InfiniteHits
        ListHeader={
          <View className="mx-8">
            <Text className="tracking-tight font-bold text-2xl text-foreground text-center">
              <Trans>Dictionary</Trans>
            </Text>

            <Text className="text-muted-foreground mt-2 text-center text-sm">
              <Trans>View all the words in your personal dictionary.</Trans>
            </Text>
          </View>
        }
      />
    </Page>
  );
}
