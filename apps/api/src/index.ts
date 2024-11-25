import "dotenv/config";

import { router, createContext } from "./trpc";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { userRouter } from "./routers/user";
import { authRouter } from "./routers/auth/github";
import { dictionaryRouter, trpcDictionaryRouter } from "./routers/dictionary";
import { flashcardRouter } from "./routers/flashcard";
import { trpcAuthRouter } from "./routers/auth";
import { csrf } from "./middleware";
import { getAllowedDomains } from "./utils";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { Session, User } from "lucia";
import { tagsRouter } from "./routers/tags";
import { settingsRouter } from "./routers/settings";
import { decksRouter } from "./routers/decks";
import $RefParser from "@apidevtools/json-schema-ref-parser";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: User;
      session: Session;
    }
  }
}

const port = process.env.PORT;

const appRouter = router({
  user: userRouter,
  auth: trpcAuthRouter,
  flashcard: flashcardRouter,
  dictionary: trpcDictionaryRouter,
  tags: tagsRouter,
  settings: settingsRouter,
  decks: decksRouter,
});

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(csrf);

const allowedDomains = getAllowedDomains(process.env.WEB_CLIENT_DOMAIN!);

app.use(
  cors({
    origin: (origin = "", callback) => {
      if (allowedDomains.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS."));
      }
    },
    credentials: true,
  }),
);

app.use(authRouter);
app.use(dictionaryRouter);

app.get("/schema.json", async (_req, res) => {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.join(__dirname, "schema.json");
    const schema = await $RefParser.bundle(schemaPath);

    return res.json(schema);
  } catch (err) {
    console.error("Error bundling the schema: ", err);

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

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
