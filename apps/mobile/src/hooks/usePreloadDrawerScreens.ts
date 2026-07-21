import { useNavigation } from "expo-router";
import { useEffect, useRef } from "react";
import { InteractionManager } from "react-native";

/**
 * Sibling drawer routes to warm up. "(home)" is omitted since it's already
 * mounted when this runs.
 */
const DRAWER_SIBLING_ROUTES = ["decks", "stats", "settings"] as const;

/**
 * `useNavigation` here isn't parameterized with the drawer's route list, so its
 * `preload` types the route name as `never`. Narrow to just the method we use.
 */
type PreloadableNavigation = { preload: (name: string) => void };

/**
 * Preloads the other drawer screens once the app is ready, mirroring the web
 * router's `defaultPreload`. Screens are lazy by default (kept off the cold-start
 * path), so the first switch to one otherwise sits on a blank frame while it
 * mounts. Preloading after interactions mounts them in the background so
 * switching is instant without paying the mount cost up front.
 */
export const usePreloadDrawerScreens = (enabled: boolean) => {
  const navigation = useNavigation() as unknown as PreloadableNavigation;
  const hasPreloadedRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasPreloadedRef.current) return;
    hasPreloadedRef.current = true;

    const task = InteractionManager.runAfterInteractions(() => {
      for (const route of DRAWER_SIBLING_ROUTES) {
        navigation.preload(route);
      }
    });

    return () => task.cancel();
  }, [enabled, navigation]);
};
