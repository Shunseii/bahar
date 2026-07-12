import "@formatjs/intl-locale/polyfill-force";

import "@formatjs/intl-pluralrules/polyfill-force";
import "@formatjs/intl-pluralrules/locale-data/en"; // locale-data for en
import "@formatjs/intl-pluralrules/locale-data/ar"; // locale-data for ar

import "@formatjs/intl-numberformat/polyfill-force";
import "@formatjs/intl-numberformat/locale-data/en";
import "@formatjs/intl-numberformat/locale-data/ar-EG";

import "@formatjs/intl-relativetimeformat/polyfill-force.js";
import "@formatjs/intl-relativetimeformat/locale-data/en.js";
import "@formatjs/intl-relativetimeformat/locale-data/ar-EG.js";

import "@formatjs/intl-datetimeformat/polyfill-force.js";
import "@formatjs/intl-datetimeformat/locale-data/en.js";
import "@formatjs/intl-datetimeformat/locale-data/ar-EG.js";
import "@formatjs/intl-datetimeformat/add-all-tz.js";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { setBackgroundColorAsync } from "expo-system-ui";
import { useEffect, useRef } from "react";
import { authClient } from "@/utils/auth-client";
import "react-native-reanimated";
import { messages as arMessages } from "@bahar/i18n/locales/ar";
import { messages as enMessages } from "@bahar/i18n/locales/en";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { i18n } from "@lingui/core";
import { I18nProvider, type TransRenderProps } from "@lingui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getLocales } from "expo-localization";
import { Provider as JotaiProvider } from "jotai";
import { Appearance, Text, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  SafeAreaListener,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { store } from "@/lib/store";
import { ThemeColorsProvider, useResolvedThemeColors } from "@/lib/theme";

import "@/global.css";
import { Uniwind } from "uniwind";
import { queryClient } from "@/utils/api";

const setRootViewBackgroundColor = () => {
  const colorScheme = Appearance.getColorScheme();
  const backgroundColor =
    colorScheme === "dark" ? "hsl(222.2, 84%, 4.9%)" : "hsl(0, 0%, 100%)";

  setBackgroundColorAsync(backgroundColor);
};

const setup = () => {
  // Prevent the splash screen from auto-hiding before asset loading is complete.
  SplashScreen.preventAutoHideAsync();

  const systemLocale =
    getLocales()[0].languageCode ??
    (getLocales()[0].languageTag.substring(0, 2) as "en" | "ar");

  const messages = systemLocale === "en" ? enMessages : arMessages;

  i18n.loadAndActivate({ locale: systemLocale, messages });

  setRootViewBackgroundColor();
};

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment:
    process.env.EXPO_PUBLIC_SENTRY_ENV ??
    (process.env.NODE_ENV === "production" ? "production" : "local"),
  enableLogs: true,
  tracesSampleRate: 1.0,
  // Sends user id/email (matching web/api) and enables route params on spans.
  sendDefaultPii: true,
  tracePropagationTargets: [
    new RegExp(`^${process.env.EXPO_PUBLIC_API_BASE_URL}`),
  ],
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    navigationIntegration,
    Sentry.mobileReplayIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],
});

setup();

function RootLayout() {
  const { isPending, data: authData } = authClient.useSession();
  const colorScheme = useColorScheme();
  const navigationRef = useNavigationContainerRef();
  const hasResolved = useRef(false);
  const [loaded] = useFonts({
    SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded && !isPending) {
      hasResolved.current = true;
      SplashScreen.hideAsync();
    }
  }, [loaded, isPending]);

  useEffect(() => {
    if (navigationRef?.current) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  useEffect(() => {
    if (authData?.user) {
      Sentry.setUser({ id: authData.user.id, email: authData.user.email });
    } else {
      Sentry.setUser(null);
    }
  }, [authData?.user]);

  if (!loaded || (!hasResolved.current && isPending)) {
    return null;
  }

  return (
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <KeyboardProvider>
              <SafeAreaProvider>
                <SafeAreaListener
                  // Enables using p-safe and m-safe class names
                  // with uniwind
                  onChange={({ insets }) => {
                    Uniwind.updateInsets(insets);
                  }}
                >
                  <View className="flex-1 bg-background">
                    <ThemeColorsInner
                      authData={authData}
                      colorScheme={colorScheme}
                    />
                  </View>
                </SafeAreaListener>
              </SafeAreaProvider>
            </KeyboardProvider>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </JotaiProvider>
  );
}

/**
 * Inner component that resolves theme colors once and provides
 * them to the entire app via context.
 */
function ThemeColorsInner({
  colorScheme,
  authData,
}: {
  colorScheme: ReturnType<typeof useColorScheme>;
  authData: unknown;
}) {
  const themeColors = useResolvedThemeColors();

  return (
    <ThemeColorsProvider value={themeColors}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
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
                  // Disabled on iOS for parity with Android (no swipe-to-
                  // dismiss). Closing happens via the X button. Keeping the
                  // native gesture caused stuck-state bugs with horizontal
                  // card swipes after partial swipe-down attempts.
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="link-account"
                options={{
                  headerShown: false,
                  animation: "slide_from_bottom",
                  gestureEnabled: true,
                  gestureDirection: "vertical",
                }}
              />
              <Stack.Screen
                name="link-code/[email]"
                options={{
                  headerShown: false,
                  animation: "slide_from_right",
                }}
              />
            </Stack.Protected>

            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
          <Toaster
            toastOptions={{
              style: {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
                borderWidth: 1,
              },
              titleStyle: { color: themeColors.foreground },
              descriptionStyle: { color: themeColors.mutedForeground },
            }}
          />
        </I18nProvider>
      </ThemeProvider>
    </ThemeColorsProvider>
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

export default Sentry.wrap(RootLayout);
