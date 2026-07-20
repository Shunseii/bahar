// Import the generated route tree

import * as Sentry from "@sentry/react";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const router = createRouter({
  routeTree,
  defaultPreload: "render",
  context: {
    authState: null,
  },
});

const isLocalEnv = import.meta.env.VITE_SENTRY_ENV === "local";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENV,
  enableLogs: true,
  integrations: [
    Sentry.tanstackRouterBrowserTracingIntegration(router),
    // Skip session replay locally -- no value in recording dev sessions, and it
    // avoids loading the replay bundle in development.
    ...(isLocalEnv ? [] : [Sentry.replayIntegration()]),
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],

  // Setting a sample rate is required for sending performance data.
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control.
  tracesSampleRate: 1.0,

  // Set `tracePropagationTargets` to control for which URLs trace propagation should be enabled
  tracePropagationTargets: [
    /^\//, // Match all local routes
    new RegExp(`^${import.meta.env.VITE_API_BASE_URL}`),
  ],

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate: isLocalEnv ? 0 : 0.1,
  replaysOnErrorSampleRate: isLocalEnv ? 0 : 1.0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
