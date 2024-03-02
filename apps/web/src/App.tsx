import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcReactClient } from "./lib/trpc";
import { RouterProvider } from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { router } from "./router";
import { queryClient } from "./lib/query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { useEffect } from "react";
import { DEFAULT_LOCALE, dynamicActivate } from "./lib/i18n";

const InnerApp = () => {
  return <RouterProvider router={router} />;
};

function App() {
  useEffect(() => {
    dynamicActivate(DEFAULT_LOCALE);
  }, []);

  return (
    <I18nProvider i18n={i18n}>
      <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <InnerApp />
          <ReactQueryDevtools />
        </QueryClientProvider>
      </trpc.Provider>
    </I18nProvider>
  );
}

export default App;
