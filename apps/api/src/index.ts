import "dotenv/config";

import express from "express";
import * as Sentry from "@sentry/node";
import { router, createContext } from "./trpc";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { dictionaryRouter, trpcDictionaryRouter } from "./routers/dictionary";
import { flashcardRouter } from "./routers/flashcard";
import { getAllowedDomains, getFullSchema } from "./utils";
import { tagsRouter } from "./routers/tags";
import { settingsRouter } from "./routers/settings";
import { decksRouter } from "./routers/decks";
import { Session, User, auth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { config } from "./utils/config";
import { logger, requestLogger } from "./utils/logger";
import { traceContextMiddleware } from "./middleware";
import { migrationsRouter } from "./routers/migrations";
import { databasesRouter } from "./routers/databases";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: User;
      session: Session;
    }
  }
}

const port = config.PORT;
const host = config.HOST;

const appRouter = router({
  flashcard: flashcardRouter,
  dictionary: trpcDictionaryRouter,
  tags: tagsRouter,
  settings: settingsRouter,
  decks: decksRouter,
  migrations: migrationsRouter,
  databases: databasesRouter,
});

const app = express();

const allowedDomains = getAllowedDomains([config.WEB_CLIENT_DOMAIN]);

app.set("trust proxy", true);

app.use(traceContextMiddleware);

app.use(requestLogger);

app.use(
  cors({
    origin: (origin = "", callback) => {
      logger.debug({ origin, allowedDomains }, "Verifying CORS");

      if (allowedDomains.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS."));
      }
    },
    credentials: true,
  }),
);

// NOTE: Make sure this is before express.json middleware
// https://github.com/better-auth/better-auth/issues/320#issuecomment-2434543200
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());
app.use(cookieParser());

app.use(dictionaryRouter);

app.get("/schema.json", async (_req, res) => {
  try {
    const schema = await getFullSchema();

    return res.json(schema);
  } catch (err) {
    logger.error("Error bundling the schema: ", err);

    return res.status(500).send("There was an error fetching the schema.");
  }
});

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get("/health", (_req, res) => {
  return res.send("OK");
});

Sentry.setupExpressErrorHandler(app);

app.listen(port, host, () => {
  logger.info(`Listening on ${host}:${port}.`);
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
