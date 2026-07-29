import { useFocusEffect } from "expo-router";
import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useAnimatedScrollHandler } from "react-native-reanimated";
import { useHeaderScroll } from "@/contexts/header-scroll";
import { headerTitleAtom } from "@/lib/store";

export function useCollapsibleHeader(title: string) {
  const { scrollY } = useHeaderScroll();
  const setHeaderTitle = useSetAtom(headerTitleAtom);

  useFocusEffect(
    useCallback(() => {
      setHeaderTitle(title);
      scrollY.value = 0;
      return () => setHeaderTitle("");
    }, [title, scrollY, setHeaderTitle])
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return { scrollHandler };
}
