import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 0, throwOnError: true, staleTime: 0, gcTime: 0 },
  },
  queryCache: new QueryCache({
    onError: (error) => Sentry.captureException(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => Sentry.captureException(error),
  }),
});
