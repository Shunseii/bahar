import { expo } from "@better-auth/expo";
import {
  checkout,
  polar,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/dist/commonjs/models/components/webhooksubscriptionupdatedpayload";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  createAuthMiddleware,
  emailOTP,
  openAPI,
} from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendMail } from "./clients/mail";
import { polarClient } from "./clients/polar";
import { redisClient } from "./clients/redis";
import { applyAllNewMigrations, createNewUserDb } from "./clients/turso";
import { db } from "./db";
import { accounts, sessions, users, verifications } from "./db/schema/auth";
import { databases } from "./db/schema/databases";
import { getAllowedDomains } from "./utils";
import { config } from "./utils/config";
import { LogCategory, logger } from "./utils/logger";

const APP_NAME = "Bahar";
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECS = 60 * 5; // 5 minutes
const SESSION_COOKIE_CACHE_EXPIRY_SECS = 60 * 5; // 5 minutes
const MOBILE_DEEP_LINK_SCHEME = "bahar://";

const allowedDomains = getAllowedDomains([config.WEB_CLIENT_DOMAIN]);

export const auth = betterAuth({
  trustedOrigins: [...allowedDomains, MOBILE_DEEP_LINK_SCHEME],
  emailAndPassword: {
    enabled: false,
  },
  appName: APP_NAME,
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.APP_DOMAIN,
  onAPIError: {
    throw: false,
    onError: (error) => {
      if (error instanceof Error) {
        logger.error(
          {
            event: "unexpected_error",
            category: LogCategory.AUTH,
            error,
          },
          "There was an unexpected error."
        );
      }
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const { path } = ctx;

      const authLogger = logger.child({
        category: LogCategory.AUTH,
        path,
      });

      const email = ctx?.body?.email?.toLowerCase();

      if (path === "/get-session") {
        authLogger.debug(
          {
            event: "get_session.start",
          },
          "Getting user session..."
        );
      } else if (path === "/email-otp/send-verification-otp") {
        authLogger.info(
          {
            event: "send_verification_otp_email.start",
            body: ctx.body,
          },
          "Sending verification otp email..."
        );

        return {
          context: {
            ...ctx,
            body: {
              ...ctx.body,
              email,
            },
          },
        };
      } else if (path === "/email-otp/verify-email") {
        authLogger.info(
          {
            event: "verify_email.start",
          },
          "Verifying email otp..."
        );

        return {
          context: {
            ...ctx,
            body: {
              ...ctx.body,
              email,
            },
          },
        };
      } else if (path === "/sign-in/email-otp") {
        authLogger.info(
          {
            event: "login_email_otp.start",
          },
          "Signing in with email otp..."
        );

        return {
          context: {
            ...ctx,
            body: {
              ...ctx.body,
              email,
            },
          },
        };
      }

      return { context: ctx };
    }),
    after: createAuthMiddleware(async (ctx) => {
      const { path } = ctx;

      const authLogger = logger.child({
        category: LogCategory.AUTH,
        path,
      });

      if (path === "/get-session") {
        authLogger.debug(
          {
            event: "get_session.end",
          },
          "Retrieved user session."
        );
      } else if (path === "/email-otp/send-verification-otp") {
        authLogger.info(
          {
            event: "send_verification_otp_email.end",
          },
          "Sent verification otp email."
        );
      } else if (path === "/email-otp/verify-email") {
        authLogger.info(
          {
            event: "verify_email.end",
          },
          "Verified email otp."
        );
      } else if (path === "/sign-in/email-otp") {
        authLogger.info(
          {
            event: "login_email_otp.end",
          },
          "Signed in with email otp."
        );
      }
    }),
  },
  logger: {
    disabled: true,
    level: "debug",
    log: (level, message, ...args) => {
      const mergedArgs = args.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      logger[level](mergedArgs, message);
    },
  },
  secondaryStorage: {
    // TODO: add trace ids to these logs

    // Upstash client will automatically deserialize JSON strings
    get: async (key) => {
      logger.debug(
        { key, category: LogCategory.DATABASE, event: "redis_get" },
        "Better auth get from redis."
      );

      return await redisClient.get(key);
    },
    set: async (key, value, ttl) => {
      logger.debug(
        {
          key,
          ttl,
          category: LogCategory.DATABASE,
          event: "redis_set",
        },
        "Better auth set to redis."
      );

      if (ttl) {
        await redisClient.set(key, JSON.stringify(value), { ex: ttl });
      } else {
        await redisClient.set(key, JSON.stringify(value));
      }
    },
    delete: async (key) => {
      logger.debug(
        {
          key,
          category: LogCategory.DATABASE,
          event: "redis_delete",
        },
        "Better auth delete from redis."
      );

      await redisClient.del(key);
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github"],
    },
  },
  socialProviders: {
    github: {
      enabled: true,
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: SESSION_COOKIE_CACHE_EXPIRY_SECS,
    },
    storeSessionInDatabase: true,
  },
  user: {
    additionalFields: {
      plan: {
        type: ["pro"],
        required: false,
        input: false,
      },
      subscriptionStatus: {
        type: ["active", "canceled"],
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    openAPI(),
    expo(),
    admin(),
    emailOTP({
      otpLength: OTP_LENGTH,
      expiresIn: OTP_EXPIRY_SECS,
      disableSignUp: false,
      sendVerificationOTP: async ({ email, otp }) => {
        logger.info(
          {
            event: "send_verification_email.start",
            category: LogCategory.AUTH,
            email,
          },
          "Sending verification email..."
        );

        // TODO: Translate this
        const emailResp = await sendMail({
          to: email,
          from: "Bahar <no-reply@auth.bahar.dev>",
          subject: "Login | Bahar",
          text: `Enter this code: ${otp}. This code only lasts for 5 minutes.`,
          html: `Enter this code: <strong>${otp}</strong>. This code only lasts for 5 minutes.`,
        });

        if (emailResp.error) {
          logger.error(
            {
              event: "send_verification_email.error",
              category: LogCategory.AUTH,
              email,
              error: emailResp.error,
            },
            "Error sending verification email."
          );
        } else {
          logger.info(
            {
              event: "send_verification_email.end",
              category: LogCategory.AUTH,
              email,
            },
            "Sent verification email."
          );
        }
      },
    }),
    polar({
      client: polarClient,
      createCustomerOnSignUp: config.NODE_ENV === "production",
      use: [
        checkout({
          products: [
            {
              productId: config.POLAR_PRO_PRODUCT_ID,
              slug: "pro",
            },
            {
              productId: config.POLAR_PRO_ANNUAL_PRODUCT_ID,
              slug: "pro_annual",
            },
          ],
          successUrl: `${allowedDomains[0]}/checkout-success`,
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: config.POLAR_WEBHOOK_SECRET,
          onSubscriptionUpdated: async (
            // need to specify the type for payload here
            // otherwise it seems fine, but the type is any
            payload: WebhookSubscriptionUpdatedPayload
          ) => {
            const { checkoutId, customerId, product, status, customer } =
              payload.data;

            const plan = (() => {
              if (
                product.id === config.POLAR_PRO_PRODUCT_ID ||
                product.id === config.POLAR_PRO_ANNUAL_PRODUCT_ID
              ) {
                return "pro";
              }

              return null;
            })();

            const childLogger = logger.child({
              category: LogCategory.APPLICATION,
              customerId,
              checkoutId,
              timestamp: payload.timestamp,
              email: customer.email,
              plan,
              productId: product.id,
              status,
            });

            if (!customer.externalId) {
              childLogger.error(
                {
                  event: "webhook_subscription_updated",
                },
                "User's external ID is missing"
              );

              throw new Error("User's external ID is missing.");
            }

            childLogger.info({
              event: "webhook_subscription_active.start",
            });

            await db
              .update(users)
              .set({
                plan,
                subscriptionStatus: status === "active" ? "active" : "canceled",
              })
              .where(eq(users.id, customer.externalId));

            const userSessions = await db
              .select({ token: sessions.token })
              .from(sessions)
              .where(eq(sessions.userId, customer.externalId));

            await Promise.all(
              userSessions.map((s) => redisClient.del(s.token))
            );

            childLogger.info({
              event: "webhook_subscription_active.end",
            });
          },
        }),
        usage(),
      ],
    }),
  ],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
    // If I don't pass these explicitly here, I get an error
    schema: {
      verifications,
      users,
      sessions,
      accounts,
    },
  }),
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          logger.info(
            {
              accountId: account.id,
              category: LogCategory.DATABASE,
              event: "account_create.start",
            },
            "Creating account..."
          );
        },
        after: async (account) => {
          logger.info(
            {
              accountId: account.id,
              category: LogCategory.DATABASE,
              event: "account_create.end",
            },
            "Created account."
          );
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          logger.info(
            {
              sessionId: session.id,
              category: LogCategory.DATABASE,
              event: "session_create.start",
            },
            "Creating session..."
          );
        },
        after: async (session) => {
          logger.info(
            {
              sessionId: session.id,
              category: LogCategory.DATABASE,
              event: "session_create.end",
            },
            "Created session."
          );
        },
      },
    },
    user: {
      create: {
        before: async (user) => {
          logger.info(
            {
              userId: user.id,
              category: LogCategory.DATABASE,
              event: "user_create.start",
            },
            "Creating user..."
          );
        },
        after: async (user) => {
          logger.info(
            {
              userId: user.id,
              category: LogCategory.DATABASE,
              event: "user_create.end",
            },
            "Created user."
          );

          await setUpUserDb(user.id);
        },
      },
    },
  },
});

/**
 * Fully sets up a new user database
 * so that it's ready for use immediately.
 *
 * This function will create the database in
 * Turso, apply all migrations in the schema
 * registry, then add it to the central databases
 * table for that user.
 */
export const setUpUserDb = async (userId: string) => {
  const { accessToken, newDb } = await createNewUserDb();

  await applyAllNewMigrations({
    dbUrl: `libsql://${newDb.hostname}`,
    dbName: newDb.name,
    token: accessToken.jwt,
  });

  await db.insert(databases).values({
    id: nanoid(),
    user_id: userId,
    db_id: newDb.id,
    hostname: newDb.hostname,
    db_name: newDb.name,
    access_token: accessToken.jwt,
  });
};

export type Session = (typeof auth.$Infer.Session)["session"];
export type User = (typeof auth.$Infer.Session)["user"];
