import "dotenv/config";

import path from "path";
import { router, createContext } from "./trpc";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { userRouter } from "./routers/user";
import { authRouter } from "./routers/auth/github";
import { dictionaryRouter } from "./routers/dictionary";
import { flashcardRouter } from "./routers/flashcard";
import { trpcAuthRouter } from "./routers/auth";
import { csrf } from "./middleware";
import { getAllowedDomains } from "./utils";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { Session, User } from "lucia";

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
});

const app = express();

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

app.get("/schema.json", (_req, res) => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(__dirname, "schema.json");

  res.sendFile(filePath);
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
