import { TRPCError, initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { validateRequest } from "./auth";
import { Ratelimit } from "@upstash/ratelimit";
import { redisClient } from "./redis";

// Created for each request
export const createContext = async ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  const { session, user } = await validateRequest(req, res);

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

export const signUpLimitProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  const rateLimit = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(5, "5 m"),
    // Disabled temporarily to save on storage space and commands
    analytics: false,
    prefix: "@upstash/ratelimit",
  });

  const ip = ctx.reqIp ?? "";
  const id = `sign-up:${ip}`;

  if (!ip) {
    console.warn("No IP address detected.");
  }

  const { success } = await rateLimit.limit(id);

  if (!success) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
  }

  return opts.next({
    ctx,
  });
});

export const otpLimitProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  const rateLimit = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.fixedWindow(1, "30 s"),
    // Disabled temporarily to save on storage space and commands
    analytics: false,
    prefix: "@upstash/ratelimit",
  });

  const ip = ctx.reqIp ?? "";
  const id = `otp:${ip}`;

  if (!ip) {
    console.warn("No IP address detected.");
  }

  const { success } = await rateLimit.limit(id);

  if (!success) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
  }

  return opts.next({
    ctx,
  });
});

export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;

  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const { user, session } = ctx;

  return opts.next({
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
