import { TooltipProvider } from "@bahar/web-ui/components/tooltip";
import { i18n } from "@lingui/core";
import { detect, fromNavigator, fromStorage } from "@lingui/detect-locale";
import { I18nProvider } from "@lingui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useToggle } from "@uidotdev/usehooks";
import { Provider as JotaiProvider } from "jotai";
import { useEffect } from "react";
import {
  DEFAULT_LOCALE,
  dynamicActivate,
  LOCALES,
  type TLocale,
} from "./lib/i18n";
import { queryClient } from "./lib/query";
import { store } from "./lib/store";
import { router } from "./router";

function App() {
  const [isI18nActivated, toggleIsI18nActivated] = useToggle(false);

  useEffect(() => {
    (async () => {
      const detectedLocale = detect(
        fromStorage("lang"),
        fromNavigator(),
        DEFAULT_LOCALE
      )!;

      // Convert en-US format to just en
      const lang = detectedLocale.split("-")[0];
      const isSupported = Object.keys(LOCALES).includes(lang);

      // If language is not supported, then use default
      const supportedLang = (isSupported ? lang : DEFAULT_LOCALE) as TLocale;

      await dynamicActivate(supportedLang);

      toggleIsI18nActivated(true);
    })();
  }, []);

  if (!isI18nActivated) {
    return;
  }

  return (
    <JotaiProvider store={store}>
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>

          {/* <ReactQueryDevtools /> */}
        </QueryClientProvider>
      </I18nProvider>
    </JotaiProvider>
  );
}

export default App;
