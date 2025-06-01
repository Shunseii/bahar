import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import {
  InstantSearch,
  useSearchBox,
  UseSearchBoxProps,
} from "react-instantsearch-core";
import { Drawer } from "expo-router/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { Redirect, usePathname } from "expo-router";
import { searchClient } from "@/utils/search";
import { useRef } from "react";

function SearchBarHeader({
  navigation,
  ...props
}: {
  navigation: DrawerNavigationProp<ParamListBase, string, undefined>;
} & UseSearchBoxProps) {
  const { query, refine } = useSearchBox(props);
  const pathname = usePathname();
  const { t } = useLingui();
  const colorScheme = useColorScheme();
  const [searchText, setSearchText] = useState(query);
  const inputRef = useRef<TextInput>(null);
  const locales = useLocales();

  const dir = locales[0].textDirection;

  const setQuery = (newQuery: string) => {
    setSearchText(newQuery);
    refine(newQuery);
  };

  if (query !== searchText && !inputRef.current?.isFocused()) {
    setSearchText(query);
  }

  return (
    <View className="flex-row items-center px-4 h-16 bg-background border-b border-border">
      <TouchableOpacity onPress={() => navigation.openDrawer()}>
        {dir === "rtl" ? (
          <PanelRight
            size={24}
            color={colorScheme === "dark" ? "white" : "black"}
          />
        ) : (
          <PanelLeft
            size={24}
            color={colorScheme === "dark" ? "white" : "black"}
          />
        )}
      </TouchableOpacity>

      {pathname === "/" && (
        <TextInput
          className="flex-1 ml-3 border border-border rounded-md px-2 h-12 text-foreground placeholder:text-muted-foreground"
          placeholder={t`Search...`}
          ref={inputRef}
          value={searchText}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
        />
      )}
    </View>
  );
}

export default function Layout() {
  const locales = useLocales();
  const { t } = useLingui();
  const { data } = authClient.useSession();

  if (!data) {
    return <Redirect href={"/login"} />;
  }

  const dir = locales[0].textDirection;

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName={data.user.id}
      future={{ preserveSharedStateOnUnmount: true }}
    >
      <Drawer
        backBehavior="history"
        drawerContent={(props) => {
          return (
            <View
              className={cn(
                "flex-1 bg-background border-border px-4 py-safe",
                dir === "rtl" && "border-l",
                dir === "ltr" && "border-r",
              )}
            >
              <View className="flex-1 my-4">
                <ScrollView alwaysBounceVertical={false}>
                  <DrawerItemList {...props} />
                </ScrollView>

                <View>
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
        }}
        screenOptions={{
          headerShown: true,
          header: ({ navigation }) => (
            <View className="pt-safe">
              <SearchBarHeader navigation={navigation} />
            </View>
          ),
        }}
      >
        <Drawer.Screen
          name="index"
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
    </InstantSearch>
  );
}
