import * as Sentry from "@sentry/bun";
import Elysia from "elysia";
import { auth, type User } from "./auth";
import { redisClient } from "./clients/redis";
import { getTraceContext } from "./utils/logger";

export { httpLogger } from "./middleware/http-logger";

export type RateLimiterOpts = {
  prefix: string;
  maxReqs: number;
  windowSecs: number;
};

type NonNullablePlan = NonNullable<User["plan"]> | "free";

/**
 * Subscription plan levels as a hierarchy so that
 * newer plans have access to lower plans.
 */
const PLAN_LEVELS = {
  free: 0,
  pro: 1,
  // the `satisfies` here ensures that if we add new plans,
  // then this will throw a type error until we've added
  // it to the map here. This is why we don't use an enum here
} as const satisfies Record<NonNullablePlan, number>;

export const betterAuthGuard = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: (role?: "admin" | "user") => ({
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });

        if (!session) return status(401);

        if (role === "admin" && session.user.role !== "admin") {
          return status(403);
        }

        const context = getTraceContext();

        context.userId = session.user.id;
        context.sessionId = session.session.id;

        Sentry.setUser({ id: session.user.id, email: session.user.email });

        return {
          user: session.user,
          session: session.session,
        };
      },
    }),
    planGuard: (plan: User["plan"]) => ({
      async resolve(opts) {
        // `user` becomes available in context from the auth macro
        const { user, status } = opts as typeof opts & { user: User };

        // allow any user to access free tier,
        // no plan means free tier
        if (!plan) return;

        const userPlanLevel = PLAN_LEVELS[user.plan ?? "free"];
        const requiredPlanLevel = PLAN_LEVELS[plan];

        if (
          userPlanLevel >= requiredPlanLevel &&
          user.subscriptionStatus === "active"
        ) {
          return;
        }

        return status(403, {
          message: `${plan} plan required.`,
        });
      },
    }),
    userRateLimit: ({ prefix, maxReqs, windowSecs }: RateLimiterOpts) => ({
      async resolve(opts) {
        // `user` becomes available in context from the auth macro
        const { status, user } = opts as typeof opts & { user: User };

        const key = `${prefix}:${user.id}`;
        const count = (await redisClient.get(key)) as number;

        if (!count) {
          await redisClient.set(key, 1, { ex: windowSecs });
          return;
        }

        if (count >= maxReqs) {
          return status(429, { message: "Rate limit exceeded" });
        }

        await redisClient.incr(key);
      },
    }),
  });
