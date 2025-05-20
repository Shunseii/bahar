import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
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

function SearchBarHeader({
  navigation,
}: {
  navigation: DrawerNavigationProp<ParamListBase, string, undefined>;
}) {
  const { t } = useLingui();
  const colorScheme = useColorScheme();
  const [searchText, setSearchText] = useState("");
  const locales = useLocales();

  const dir = locales[0].textDirection;

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

      <TextInput
        className="flex-1 ml-3 border border-border rounded-md px-2 h-12 text-foreground placeholder:text-muted-foreground"
        placeholder={t`Search...`}
        value={searchText}
        onChangeText={setSearchText}
      />
    </View>
  );
}

export default function Layout() {
  const locales = useLocales();
  const { t } = useLingui();

  const dir = locales[0].textDirection;

  return (
    <Drawer
      backBehavior="history"
      drawerContent={(props) => {
        return (
          <View
            className={cn(
              "flex-1 bg-background border-border px-4 pt-safe",
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
          <SafeAreaView>
            <SearchBarHeader navigation={navigation} />
          </SafeAreaView>
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
  );
}
