import { treaty } from "@elysiajs/eden";
import * as Sentry from "@sentry/react-native";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { App } from "../../../api/src/index";
import { authClient } from "./auth-client";

// Report query/mutation failures to Sentry. Mirrors web (apps/web/src/lib/query.ts);
// without this, mobile query errors (e.g. the edit page's "Dictionary entry not
// found") are completely invisible in Sentry.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => Sentry.captureException(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => Sentry.captureException(error),
  }),
});

export const api = treaty<App>(process.env.EXPO_PUBLIC_API_BASE_URL!, {
  headers: () => ({
    cookie: authClient.getCookie(),
  }),
});
