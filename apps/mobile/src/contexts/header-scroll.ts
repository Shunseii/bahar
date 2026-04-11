import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

interface HeaderScrollContextValue {
  scrollY: SharedValue<number>;
  headerTitle: string;
  setHeaderTitle: (title: string) => void;
}

export const HeaderScrollContext =
  createContext<HeaderScrollContextValue | null>(null);

export const useHeaderScroll = () => {
  const context = useContext(HeaderScrollContext);
  if (!context) {
    throw new Error("useHeaderScroll must be used within HeaderScrollContext");
  }
  return context;
};
