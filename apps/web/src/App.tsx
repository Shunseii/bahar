import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcReactClient } from "./lib/trpc";
import { RouterProvider } from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { router } from "./router";
import { queryClient } from "./lib/query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { useEffect } from "react";
import { DEFAULT_LOCALE, LOCALES, TLocale, dynamicActivate } from "./lib/i18n";
import { detect, fromStorage, fromNavigator } from "@lingui/detect-locale";
import { TooltipProvider } from "./components/ui/tooltip";
import { useToggle } from "@uidotdev/usehooks";

function App() {
  const [isI18nActivated, toggleIsI18nActivated] = useToggle(false);

  useEffect(() => {
    (async () => {
      const detectedLocale = detect(
        fromStorage("lang"),
        fromNavigator(),
        DEFAULT_LOCALE,
      )!;

      // Convert en-US format to just en
      const lang = detectedLocale.split("-")[0];
      const isSupported = Object.keys(LOCALES).includes(lang);

      // If language is not supported, then use default
      const supportedLang = (!isSupported ? DEFAULT_LOCALE : lang) as TLocale;

      await dynamicActivate(supportedLang);

      toggleIsI18nActivated(true);
    })();
  }, []);

  if (!isI18nActivated) {
    return;
  }

  return (
    <I18nProvider i18n={i18n}>
      <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>

          {/* <ReactQueryDevtools /> */}
        </QueryClientProvider>
      </trpc.Provider>
    </I18nProvider>
  );
}

export default App;
