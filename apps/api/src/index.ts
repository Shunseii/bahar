// Sentry must be initialized before any other imports
import * as Sentry from "@sentry/bun";

// Ensure to call this before importing any other modules!
Sentry.init({
  environment: process.env.SENTRY_ENV,
  dsn: process.env.SENTRY_DSN,
  release: process.env.GITHUB_SHA,
  tracesSampleRate: 1.0,
});

import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { betterAuthGuard, httpLogger } from "./middleware";
import { databasesRouter } from "./routers/databases";
import { migrationsRouter } from "./routers/migrations";
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
