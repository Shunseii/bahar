import "@formatjs/intl-locale/polyfill-force";

import "@formatjs/intl-pluralrules/polyfill-force";
import "@formatjs/intl-pluralrules/locale-data/en"; // locale-data for en
import "@formatjs/intl-pluralrules/locale-data/ar"; // locale-data for ar

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { authClient } from "@/utils/auth-client";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { setBackgroundColorAsync } from "expo-system-ui";
import { useEffect } from "react";
import "react-native-reanimated";
import { vars } from "nativewind";
import { View, Text, Appearance, useColorScheme } from "react-native";
import { I18nProvider, TransRenderProps } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getLocales } from "expo-localization";
import { cssVariables } from "@bahar/design-system/theme";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner-native";

import { messages as enMessages } from "@bahar/i18n/locales/en";
import { messages as arMessages } from "@bahar/i18n/locales/ar";

import "@/global.css";
import { queryClient } from "@/utils/trpc";

const setRootViewBackgroundColor = async () => {
  const colorScheme = Appearance.getColorScheme();
  const themeColors =
    colorScheme === "dark" ? cssVariables.dark : cssVariables.light;

  setBackgroundColorAsync(`hsl(${themeColors["--background"]})`);
};

const setup = async () => {
  // Prevent the splash screen from auto-hiding before asset loading is complete.
  SplashScreen.preventAutoHideAsync();

  const systemLocale =
    getLocales()[0].languageCode ??
    (getLocales()[0].languageTag.substring(0, 2) as "en" | "ar");

  const messages = systemLocale === "en" ? enMessages : arMessages;

  i18n.loadAndActivate({ locale: systemLocale, messages });

  setRootViewBackgroundColor();
};

setup();

export default function RootLayout() {
  const { isPending, data: authData } = authClient.useSession();
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded && !isPending) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isPending]);

  const themeVars =
    colorScheme === "dark" ? cssVariables.dark : cssVariables.light;

  if (!loaded || isPending) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={vars(themeVars)} className="flex-1">
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <I18nProvider i18n={i18n} defaultComponent={DefaultComponent}>
                <Stack>
                  <Stack.Protected guard={!authData}>
                    <Stack.Screen
                      name="(auth)"
                      options={{ headerShown: false, animation: "fade" }}
                    />
                  </Stack.Protected>

                  <Stack.Protected guard={!!authData}>
                    <Stack.Screen
                      name="(search)"
                      options={{ headerShown: false, animation: "fade" }}
                    />
                  </Stack.Protected>

                  <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style="auto" />
              </I18nProvider>
            </ThemeProvider>
          </View>

          <Toaster />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

/**
 * Ensures all lingui text using Trans macro
 * is wrapped in a Text component which is
 * required by react native.
 */
const DefaultComponent = (props: TransRenderProps) => {
  return <Text>{props.children}</Text>;
};
