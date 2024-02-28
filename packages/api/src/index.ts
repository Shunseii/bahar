import "dotenv/config";

import { router, createContext } from "./trpc";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { userRouter } from "./routers/user";
import { authRouter, trpcAuthRouter } from "./routers/auth";
import { csrf } from "./middleware";

const port = process.env.APP_PORT;

const appRouter = router({
  user: userRouter,
  auth: trpcAuthRouter,
});

const app = express();

app.use(cookieParser());
app.use(csrf);

app.use(
  cors({
    origin: process.env.WEB_CLIENT_BASE_URL,
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
