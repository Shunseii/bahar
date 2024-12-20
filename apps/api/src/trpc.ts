import { TRPCError, initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";
import { Session, User, auth } from "./auth";

// Created for each request
export const createContext = async ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  const { api } = auth;

  const data = (await api.getSession({
    headers: fromNodeHeaders(req.headers),
  })) as { session: Session; user: User };

  if (!data) {
    return {
      session: null,
      user: null,
      reqIp: req.ip,
      setHeaders: (name: string, value: string) => {
        res.setHeader(name, value);
      },
    };
  }

  const { session, user } = data;

  return {
    session,
    user,
    reqIp: req.ip,
    setHeaders: (name: string, value: string) => {
      res.setHeader(name, value);
    },
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create();

export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const { user, session } = ctx;

  return next({
    ctx: {
      // These are inferred as non-null now
      user,
      session,
    },
  });
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;
