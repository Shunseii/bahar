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
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { setBackgroundColorAsync } from "expo-system-ui";
import { useEffect } from "react";
import { authClient } from "@/utils/auth-client";
import "react-native-reanimated";
import { messages as arMessages } from "@bahar/i18n/locales/ar";
import { messages as enMessages } from "@bahar/i18n/locales/en";
import { i18n } from "@lingui/core";
import { I18nProvider, type TransRenderProps } from "@lingui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getLocales } from "expo-localization";
import { Provider as JotaiProvider } from "jotai";
import { Appearance, Text, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { store } from "@/lib/store";

import "@/global.css";
import { queryClient } from "@/utils/api";

const setRootViewBackgroundColor = async () => {
  const colorScheme = Appearance.getColorScheme();
  const backgroundColor =
    colorScheme === "dark" ? "hsl(222.2, 84%, 4.9%)" : "hsl(0, 0%, 100%)";

  setBackgroundColorAsync(backgroundColor);
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

  if (!loaded || isPending) {
    return null;
  }

  return (
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <View className="flex-1 bg-background">
              <ThemeProvider
                value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
              >
                <I18nProvider defaultComponent={DefaultComponent} i18n={i18n}>
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
                      <Stack.Screen
                        name="review"
                        options={{
                          headerShown: false,
                          animation: "slide_from_bottom",
                          gestureEnabled: true,
                          gestureDirection: "vertical",
                        }}
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
    </JotaiProvider>
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
