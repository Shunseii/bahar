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
import { useEffect } from "react";
import "react-native-reanimated";
import { vars } from "nativewind";
import { View, Text } from "react-native";
import { I18nProvider, TransRenderProps } from "@lingui/react";
import { i18n } from "@lingui/core";

import { useColorScheme } from "@/hooks/useColorScheme";
import { cssVariables } from "@bahar/tailwind-config/theme";
import { messages } from "@bahar/i18n/locales/en";

import "@/global.css";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

i18n.loadAndActivate({ locale: "en", messages });

const DefaultComponent = (props: TransRenderProps) => {
  return <Text>{props.children}</Text>;
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  // Apply CSS variables based on the current theme
  const themeVars =
    colorScheme === "dark" ? cssVariables.dark : cssVariables.light;

  return (
    <View style={vars(themeVars)} className="flex-1">
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <I18nProvider i18n={i18n} defaultComponent={DefaultComponent}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </I18nProvider>
      </ThemeProvider>
    </View>
  );
}
