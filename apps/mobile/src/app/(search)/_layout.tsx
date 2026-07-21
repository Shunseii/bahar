import { cn } from "@bahar/design-system";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  type DrawerContentComponentProps,
  DrawerItemList,
  type DrawerNavigationProp,
} from "@react-navigation/drawer";
import type { ParamListBase } from "@react-navigation/native";
import { useLocales } from "expo-localization";
import { usePathname } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { useAtomValue } from "jotai";
import {
  Activity,
  Home,
  Layers,
  PanelLeft,
  PanelRight,
  Settings,
} from "lucide-react-native";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StreakChip from "@/components/progress/StreakChip";
import { SyncIndicator } from "@/components/SyncIndicator";
import { Button } from "@/components/ui/button";
import { HeaderScrollContext } from "@/contexts/header-scroll";
import { useSearch } from "@/hooks/useSearch";
import { resetDb, SYNC_INTERVAL_MS } from "@/lib/db";
import { performSync } from "@/lib/db/sync";
import { rehydrateOramaDb, resetOramaDb } from "@/lib/search";
import {
  dictionaryChangedAtom,
  isSyncingAtom,
  store,
  syncCompletedCountAtom,
} from "@/lib/store";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";
import { authClient } from "@/utils/auth-client";

// Search context to share search query between layout and screens
interface SearchContextValue {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export const useSearchQuery = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchQuery must be used within SearchContext");
  }
  return context;
};

function SearchBarHeader({
  navigation,
  searchQuery,
  onSearchChange,
  scrollY,
  headerTitle,
}: {
  navigation: DrawerNavigationProp<ParamListBase, string, undefined>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scrollY: SharedValue<number>;
  headerTitle: string;
}) {
  const pathname = usePathname();
  const { t } = useLingui();
  const colors = useThemeColors();
  const inputRef = useRef<TextInput>(null);
  const locales = useLocales();
  const insets = useSafeAreaInsets();

  const dir = locales[0].textDirection;
  const isAddWordPage = pathname.includes("add-word");
  const showSearchBar = pathname === "/" && !isAddWordPage;

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [30, 70], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View
      className="border-border border-b bg-background"
      style={{ paddingTop: insets.top }}
    >
      <View className="h-14 flex-row items-center px-4">
        <TouchableOpacity
          className="-ml-2 p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => navigation.openDrawer()}
        >
          {dir === "rtl" ? (
            <PanelRight color={colors.foreground} size={24} />
          ) : (
            <PanelLeft color={colors.foreground} size={24} />
          )}
        </TouchableOpacity>

        {showSearchBar ? (
          <>
            <TextInput
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              className="ml-2 h-10 flex-1 rounded-md border border-border px-3 text-foreground"
              clearButtonMode="while-editing"
              onChangeText={onSearchChange}
              placeholder={t`Search...`}
              placeholderTextColor={colors.mutedForeground}
              ref={inputRef}
              spellCheck={false}
              value={searchQuery}
            />
            <StreakChip className="ml-2" />
          </>
        ) : headerTitle ? (
          <Animated.View className="ml-3" style={titleAnimatedStyle}>
            <RNText className="font-semibold text-foreground text-lg">
              {headerTitle}
            </RNText>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function DrawerContent(props: DrawerContentComponentProps) {
  const locales = useLocales();
  const insets = useSafeAreaInsets();
  const dir = locales[0].textDirection;

  return (
    <View
      className={cn(
        "flex-1 border-border bg-background",
        dir === "rtl" && "border-l",
        dir === "ltr" && "border-r"
      )}
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View className="flex-1 px-4 py-4">
        <ScrollView alwaysBounceVertical={false} className="flex-1">
          <DrawerItemList {...props} />
        </ScrollView>

        <View className="mt-4">
          <Button
            onPress={async () => {
              queryClient.clear();
              resetOramaDb();
              await resetDb();
              await authClient.signOut();
            }}
            variant="secondary"
          >
            <Trans>Logout</Trans>
          </Button>
        </View>
      </View>
    </View>
  );
}

export default function Layout() {
  const locales = useLocales();
  const { t } = useLingui();
  const [searchQuery, setSearchQuery] = useState("");
  const [headerTitle, setHeaderTitle] = useState("");
  const scrollY = useSharedValue(0);
  const syncCompletedCount = useAtomValue(syncCompletedCountAtom);
  const { refresh } = useSearch();

  useEffect(() => {
    const interval = setInterval(() => {
      performSync().catch(() => {});
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (syncCompletedCount === 0) return;

    const refreshAfterSync = async () => {
      const dictionaryChanged = store.get(dictionaryChangedAtom);
      if (dictionaryChanged) {
        store.set(isSyncingAtom, true);
        await rehydrateOramaDb();
        refresh();
        setSearchQuery("");
        store.set(dictionaryChangedAtom, false);
        store.set(isSyncingAtom, false);
        console.log("[sync] Orama reindexed after sync");
      }

      await queryClient.invalidateQueries();
    };

    refreshAfterSync();
  }, [syncCompletedCount, refresh]);

  const dir = locales[0].textDirection;

  return (
    <HeaderScrollContext.Provider
      value={{ scrollY, headerTitle, setHeaderTitle }}
    >
      <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
        <Drawer
          backBehavior="history"
          drawerContent={(props) => <DrawerContent {...props} />}
          screenOptions={{
            headerShown: true,
            // Freeze blurred screens so keeping them mounted (via preload) stays
            // cheap. Screens are preloaded after the home screen is ready (see
            // its usePreloadDrawerScreens) so switching is instant without
            // paying the mount cost up front on cold start.
            freezeOnBlur: true,
            drawerPosition: dir === "rtl" ? "right" : "left",
            header: ({ navigation }) => (
              <SearchBarHeader
                headerTitle={headerTitle}
                navigation={navigation}
                onSearchChange={setSearchQuery}
                scrollY={scrollY}
                searchQuery={searchQuery}
              />
            ),
          }}
        >
          <Drawer.Screen
            name="(home)"
            options={{
              swipeEdgeWidth: 300,
              drawerIcon: ({ color, size }) => (
                <Home color={color} size={size} />
              ),
              title: t`Home`,
            }}
          />

          <Drawer.Screen
            name="decks"
            options={{
              swipeEdgeWidth: 300,
              drawerIcon: ({ color, size }) => (
                <Layers color={color} size={size} />
              ),
              title: t`Decks`,
            }}
          />

          <Drawer.Screen
            name="stats"
            options={{
              swipeEdgeWidth: 300,
              drawerIcon: ({ color, size }) => (
                <Activity color={color} size={size} />
              ),
              title: t`Progress`,
            }}
          />

          <Drawer.Screen
            name="settings"
            options={{
              swipeEdgeWidth: 300,
              drawerIcon: ({ color, size }) => (
                <Settings color={color} size={size} />
              ),
              title: t`Settings`,
            }}
          />
        </Drawer>
        <SyncIndicator />
      </SearchContext.Provider>
    </HeaderScrollContext.Provider>
  );
}
