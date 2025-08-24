import React, { ComponentType, FC, ReactElement } from "react";
import { Hit as BaseHitType } from "instantsearch.js";
import { Text, FlatList, View } from "react-native";
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

type HitType = BaseHitType<DictionarySchema>;

interface HitProps {
  hit: HitType;
}

export const Hit: FC<HitProps> = ({ hit }) => {
  return <Text className="text-foreground">{hit.word}</Text>;
};

export const InfiniteHits = ({
  HitComponent = Hit,
  ListHeader,
  ...props
}: {
  HitComponent?: ComponentType<HitProps>;
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
    <View className="flex-1 mx-4">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4 bg-background rounded-md border border-border"
        ItemSeparatorComponent={() => (
          <View className="border-border border-b mx-8" />
        )}
        ListHeaderComponent={ListHeader}
        onEndReached={handleEndReached}
        renderItem={({ item }) => (
          <View className="p-4 px-8">
            <HitComponent hit={item} />
          </View>
        )}
      />
    </View>
  );
};
