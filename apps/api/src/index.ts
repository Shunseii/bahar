import "dotenv/config";

import { router, createContext } from "./trpc.js";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { userRouter } from "./routers/user.js";
import { authRouter, trpcAuthRouter } from "./routers/auth.js";
import { csrf } from "./middleware.js";
import { getAllowedDomains } from "./utils.js";

const port = process.env.PORT;

const appRouter = router({
  user: userRouter,
  auth: trpcAuthRouter,
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
