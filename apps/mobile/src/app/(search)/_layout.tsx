import React, { useState, useRef, createContext, useContext, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Drawer } from "expo-router/drawer";
import { DrawerItemList, DrawerNavigationProp } from "@react-navigation/drawer";
import { ParamListBase } from "@react-navigation/native";
import {
  PanelLeft,
  PanelRight,
  Home,
  Layers,
  Settings,
} from "lucide-react-native";
import { Trans, useLingui } from "@lingui/react/macro";
import { useLocales } from "expo-localization";
import { authClient } from "@/utils/auth-client";
import { Button } from "@/components/ui/button";
import { ScrollView } from "react-native-gesture-handler";
import { cn } from "@bahar/design-system";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAtomValue } from "jotai";
import { store, syncCompletedCountAtom, isSyncingAtom } from "@/lib/store";
import { queryClient } from "@/utils/trpc";
import { rehydrateOramaDb } from "@/lib/search";
import { SyncIndicator } from "@/components/SyncIndicator";
import { syncDatabase } from "@/lib/db/adapter";
import { SYNC_INTERVAL_MS } from "@/lib/db";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { useThemeColors } from "@/lib/theme";

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
      className="bg-background border-b border-border"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center px-4 h-14">
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          className="p-2 -ml-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {dir === "rtl" ? (
            <PanelRight
              size={24}
              color={colors.foreground}
            />
          ) : (
            <PanelLeft
              size={24}
              color={colors.foreground}
            />
          )}
        </TouchableOpacity>

        {showSearchBar && (
          <TextInput
            className="flex-1 ml-2 border border-border rounded-md px-3 h-10 text-foreground"
            placeholder={t`Search...`}
            placeholderTextColor={colors.mutedForeground}
            ref={inputRef}
            value={searchQuery}
            onChangeText={onSearchChange}
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
          />
        )}
      </View>
    </View>
  );
}

function DrawerContent(props: any) {
  const locales = useLocales();
  const insets = useSafeAreaInsets();
  const dir = locales[0].textDirection;

  return (
    <View
      className={cn(
        "flex-1 bg-background border-border",
        dir === "rtl" && "border-l",
        dir === "ltr" && "border-r",
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
            variant="secondary"
            onPress={async () => {
              await authClient.signOut();
            }}
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
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
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
