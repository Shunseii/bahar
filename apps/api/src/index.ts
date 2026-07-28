// Sentry must be initialized before any other imports
import * as Sentry from "@sentry/bun";

// Ensure to call this before importing any other modules!
Sentry.init({
  environment: process.env.SENTRY_ENV,
  dsn: process.env.SENTRY_DSN,
  release: process.env.GITHUB_SHA,
  tracesSampleRate: 1.0,
  enableLogs: true,
});

import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { betterAuthGuard, httpLogger } from "./middleware";
import { aiRouter } from "./routers/ai";
import { databasesRouter } from "./routers/databases";
import { dictionaryRouter } from "./routers/dictionary";
import { marketingRouter } from "./routers/marketing";
import { migrationsRouter } from "./routers/migrations";
import { statsRouter } from "./routers/stats";
import { getAllowedDomains } from "./utils";
import { config } from "./utils/config";
import { logger, traceContext } from "./utils/logger";

const port = config.PORT;
const host = config.HOST;

const allowedDomains = getAllowedDomains([config.WEB_CLIENT_DOMAIN]);

const app = new Elysia()
  .use(httpLogger)
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get("origin") ?? "";

        logger.debug({ origin, allowedDomains }, "Verifying CORS");

        return allowedDomains.includes(origin) || !origin;
      },
      credentials: true,
    })
  )
  .use(betterAuthGuard)
  // Publishes the machine-readable schema for these routes at /openapi/json
  // (and a browsable reference at /openapi), so a client -- notably an agent
  // driving the CLI -- can discover the write endpoints and their payloads
  // without reading this source. Auth routes have their own reference, served
  // by better-auth's openAPI plugin at /api/auth/reference.
  .use(
    openapi({
      path: "/openapi",
      documentation: {
        info: {
          title: "Bahar API",
          version: "1.0.0",
          description:
            "Dictionary and flashcard endpoints. Authenticate with a session cookie, or with an API key in the `x-api-key` header (create one in the web app under Settings → API keys).",
        },
      },
    })
  )
  .onRequest(({ request, set }) => {
    const existingId = request.headers.get("x-request-id");
    const traceId = existingId || crypto.randomUUID();

    set.headers["X-Request-Id"] = traceId;

    // Store trace context for this request
    traceContext.enterWith({
      traceId,
      seqNum: 0,
    });
  })
  .get("/health", () => "OK")
  .use(migrationsRouter)
  .use(databasesRouter)
  .use(dictionaryRouter)
  .use(aiRouter)
  .use(statsRouter)
  .use(marketingRouter)
  .onError(({ error, code }) => {
    Sentry.captureException(error);

    logger.error({ error, code }, "Request error");
  })
  .listen({
    port,
    hostname: host,
  });

logger.info(`Listening on ${host}:${port}.`);

export type App = typeof app;
