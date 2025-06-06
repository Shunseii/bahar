import React, { ComponentType, FC, ReactElement } from "react";
import { Hit } from "instantsearch.js";
import { Text, FlatList, View } from "react-native";
import { Page } from "@/components/Page";
import {
  useInfiniteHits,
  UseInfiniteHitsProps,
} from "react-instantsearch-core";

// TODO: centralize this
type DictionarySchema = {
  id: string;
  word: string;
  definition: string;
};

type HitType = Hit<DictionarySchema>;

interface HitProps {
  hit: HitType;
}

const Hit: FC<HitProps> = ({ hit }) => {
  return <Text className="text-foreground">{hit.word}</Text>;
};

const InfiniteHits = ({
  hitComponent: Hit,
  ListHeader,
  ...props
}: {
  hitComponent: ComponentType<HitProps>;
  ListHeader: ReactElement;
} & Omit<UseInfiniteHitsProps<HitType>, "escapeHTML">) => {
  const { items, isLastPage, showMore } = useInfiniteHits<HitType>({
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
