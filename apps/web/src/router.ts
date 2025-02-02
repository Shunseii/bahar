// Import the generated route tree
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import * as Sentry from "@sentry/react";

// Create a new router instance
export const router = createRouter({
  routeTree,
  defaultPreload: "render",
  context: {
    authState: undefined!,
  },
});

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENV,
  integrations: [
    Sentry.tanstackRouterBrowserTracingIntegration(router),
    Sentry.replayIntegration(),
  ],

  // Setting a sample rate is required for sending performance data.
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control.
  tracesSampleRate: 1.0,

  // Set `tracePropagationTargets` to control for which URLs trace propagation should be enabled
  tracePropagationTargets: [
    new RegExp("^/"), // Match all local routes
    new RegExp(`^${import.meta.env.VITE_API_BASE_URL}`),
    new RegExp(`^${import.meta.env.VITE_MEILISEARCH_API_URL}`),
  ],

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
