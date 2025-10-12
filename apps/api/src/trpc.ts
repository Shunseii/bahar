import { TRPCError, initTRPC } from "@trpc/server";
import * as Sentry from "@sentry/node";
import * as trpcExpress from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";
import { Session, User, auth } from "./auth";
import { getTraceContext, logger } from "./utils/logger";

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
      logger,
      setHeaders: (name: string, value: string) => {
        res.setHeader(name, value);
      },
    };
  }

  const context = getTraceContext();
  const { session, user } = data;

  context.userId = user.id;
  context.sessionId = session.id;

  Sentry.setUser({ id: user.id, email: user.email });

  return {
    session,
    user,
    logger,
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

    const procedureChildLogger = ctx.logger.child({ operation: path });

    try {
      const result = await next({
        ctx: { ...ctx, logger: procedureChildLogger },
      });
      const durationMs = Date.now() - start;

      procedureChildLogger.info(
        {
          operationType: type,
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
          operationType: type,
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

const sentryMiddleware = t.middleware(
  Sentry.trpcMiddleware({
    attachRpcInput: true,
  }),
);

export const protectedProcedure = t.procedure
  .use(sentryMiddleware)
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

export const adminProcedure = t.procedure
  .use(sentryMiddleware)
  .use(loggingMiddleware)
  .use(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || !ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const { user, session } = ctx;

    if (user.role !== "admin") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

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
export const publicProcedure = t.procedure.use(sentryMiddleware);
