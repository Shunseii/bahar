import React, { ReactNode, ComponentType, ReactElement } from "react";
import { Text, FlatList, View } from "react-native";
import { Page } from "@/components/Page";
import {
  useInfiniteHits,
  UseInfiniteHitsProps,
} from "react-instantsearch-core";

const InfiniteHits = ({
  hitComponent: Hit,
  ListHeader,
  ...props
  // TODO: type the hit properly
}: {
  hitComponent: ComponentType<{ hit: unknown }>;
  ListHeader: ReactElement;
} & Omit<UseInfiniteHitsProps, "escapeHTML">) => {
  const { items, isLastPage, showMore } = useInfiniteHits({
    ...props,
    escapeHTML: false,
  });

  const handleEndReached = React.useCallback(() => {
    if (!isLastPage) {
      showMore();
    }
  }, [isLastPage, showMore]);

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => (
        <View className="border-border border-b mx-8" />
      )}
      ListHeaderComponent={ListHeader}
      onEndReached={handleEndReached}
      renderItem={({ item }) => (
        <View className="p-4 px-8">
          <Hit hit={item} />
        </View>
      )}
    />
  );
};

export default function HomeScreen() {
  return (
    <Page className="pt-0 px-0">
      <InfiniteHits
        hitComponent={Hit}
        ListHeader={
          <View className="pt-8 px-8">
            <Text className="tracking-tight font-bold text-2xl text-foreground text-center">
              This is your personalized Arabic dictionary!
            </Text>

            <Text className="text-muted-foreground mt-2 text-center text-sm">
              Add words to get started.
            </Text>
          </View>
        }
      />
    </Page>
  );
}

const Hit = ({ hit }: { hit: unknown }) => {
  return <Text className="text-foreground">{(hit as any).word}</Text>;
};
