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
  Home,
  Layers,
  PanelLeft,
  PanelRight,
  Settings,
} from "lucide-react-native";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SyncIndicator } from "@/components/SyncIndicator";
import { Button } from "@/components/ui/button";
import { SYNC_INTERVAL_MS } from "@/lib/db";
import { syncDatabase } from "@/lib/db/adapter";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { rehydrateOramaDb } from "@/lib/search";
import { isSyncingAtom, store, syncCompletedCountAtom } from "@/lib/store";
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
}: {
  navigation: DrawerNavigationProp<ParamListBase, string, undefined>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
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
            <PanelRight className="text-foreground" size={24} />
          ) : (
            <PanelLeft className="text-foreground" size={24} />
          )}
        </TouchableOpacity>

        {showSearchBar && (
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
        )}
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
  const syncCompletedCount = useAtomValue(syncCompletedCountAtom);
  const dictionaryChangedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        store.set(isSyncingAtom, true);

        const maxTsBefore = await dictionaryEntriesTable.maxUpdatedAt.query();

        await syncDatabase();

        const maxTsAfter = await dictionaryEntriesTable.maxUpdatedAt.query();
        dictionaryChangedRef.current = maxTsBefore !== maxTsAfter;

        store.set(syncCompletedCountAtom, (c) => c + 1);
        console.log("[sync] Background sync complete", {
          dictionaryChanged: dictionaryChangedRef.current,
        });
      } catch (error) {
        console.warn("[sync] Background sync failed:", error);
      } finally {
        store.set(isSyncingAtom, false);
      }
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (syncCompletedCount === 0) return;

    const refreshAfterSync = async () => {
      if (dictionaryChangedRef.current) {
        await rehydrateOramaDb();
        setSearchQuery("");
        console.log("[sync] Orama reindexed after sync");
      }

      await queryClient.invalidateQueries();
    };

    refreshAfterSync();
  }, [syncCompletedCount]);

  const dir = locales[0].textDirection;

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <Drawer
        backBehavior="history"
        drawerContent={(props) => <DrawerContent {...props} />}
        screenOptions={{
          headerShown: true,
          drawerPosition: dir === "rtl" ? "right" : "left",
          header: ({ navigation }) => (
            <SearchBarHeader
              navigation={navigation}
              onSearchChange={setSearchQuery}
              searchQuery={searchQuery}
            />
          ),
        }}
      >
        <Drawer.Screen
          name="(home)"
          options={{
            swipeEdgeWidth: 300,
            drawerIcon: (props) => <Home {...props} />,
            title: t`Home`,
          }}
        />

        <Drawer.Screen
          name="decks"
          options={{
            swipeEdgeWidth: 300,
            drawerIcon: (props) => <Layers {...props} />,
            title: t`Decks`,
          }}
        />

        <Drawer.Screen
          name="settings"
          options={{
            swipeEdgeWidth: 300,
            drawerIcon: (props) => <Settings {...props} />,
            title: t`Settings`,
          }}
        />
      </Drawer>
      <SyncIndicator />
    </SearchContext.Provider>
  );
}
