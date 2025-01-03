import { TRPCError, initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";
import { Session, User, auth } from "./auth";
import { logger } from "./logger";

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
      logger: logger.child({
        req: { id: req.id },
      }),
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
    logger: logger.child({
      req: { id: req.id },
    }),
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

export const loggingMiddleware = t.middleware(
  async ({ path, type, getRawInput, next, ctx }) => {
    const start = Date.now();
    const input = await getRawInput();

    const procedureChildLogger = ctx.logger.child({ path });

    try {
      const result = await next({
        ctx: { ...ctx, logger: procedureChildLogger },
      });
      const durationMs = Date.now() - start;

      procedureChildLogger.info(
        {
          type,
          input,
          durationMs,
          success: true,
        },
        "tRPC request completed",
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - start;

      procedureChildLogger.error(
        {
          type,
          input,
          durationMs,
          error,
          success: false,
        },
        "tRPC request failed",
      );

      throw error;
    }
  },
);

export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(async (opts) => {
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
