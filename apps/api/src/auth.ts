import { expo } from "@better-auth/expo";
import {
  checkout,
  polar,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";
// @ts-ignore - resolves under Node moduleResolution but not Bundler (web app imports App type from this file)
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/dist/commonjs/models/components/webhooksubscriptionupdatedpayload";
import type { BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  anonymous,
  createAuthMiddleware,
  emailOTP,
  openAPI,
} from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { buildAppleClientSecret } from "./clients/apple";
import { sendMail } from "./clients/mail";
import { polarClient } from "./clients/polar";
import { redisClient } from "./clients/redis";
import {
  applyAllNewMigrations,
  createNewUserDb,
  tursoPlatformClient,
} from "./clients/turso";
import { db } from "./db";
import { accounts, sessions, users, verifications } from "./db/schema/auth";
import { databases } from "./db/schema/databases";
import { revlogs } from "./db/schema/revlogs";
import { getAllowedDomains } from "./utils";
import { config } from "./utils/config";
import { LogCategory, logger } from "./utils/logger";
import {
  isSubscriptionStatus,
  SUBSCRIPTION_STATUSES,
} from "./utils/subscription-statuses";

const APP_NAME = "Bahar";
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECS = 60 * 5; // 5 minutes
const SESSION_COOKIE_CACHE_EXPIRY_SECS = 60 * 5; // 5 minutes
const MOBILE_DEEP_LINK_SCHEME = "bahar://";
const MOBILE_APP_BUNDLE_ID = "dev.bahar.app";

const allowedDomains = getAllowedDomains([config.WEB_CLIENT_DOMAIN]);

const appleClientSecret = await buildAppleClientSecret();

const consentEventsPlugin = () => {
  return {
    id: "consent-event",
    schema: {
      consentEvent: {
        fields: {
          userId: {
            type: "string",
            required: true,
            index: true,
            references: {
              model: "users",
              field: "id",
              onDelete: "cascade",
            },
          },
          action: {
            type: ["granted", "withdrawn"] as const,
            required: true,
          },
          source: {
            type: ["app_modal", "app_settings", "resend_webhook"] as const,
            required: true,
          },
          ipAddress: {
            type: "string",
            required: false,
          },
          createdAt: {
            type: "date",
            required: true,
            defaultValue: () => new Date(),
          },
        },
      },
    },
  } satisfies BetterAuthPlugin;
};

export const auth = betterAuth({
  trustedOrigins: [
    ...allowedDomains,
    MOBILE_DEEP_LINK_SCHEME,
    // Needed for Apple SSO
    "https://appleid.apple.com",
  ],
  emailAndPassword: {
    enabled: false,
  },
  appName: APP_NAME,
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.APP_DOMAIN,
  advanced: {
    defaultCookieAttributes: {
      sameSite: config.NODE_ENV === "production" ? "lax" : "none",
      secure: true,
    },
  },
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
    level: "debug",
    log: (level, message, ...args) => {
      const mergedArgs = args.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      logger[level](mergedArgs, message);
    },
  },
  rateLimit: {
    customRules: {
      "/sign-in/anonymous": {
        window: 60, // in seconds
        max: 3, // max requests in window
      },
    },
    storage: config.NODE_ENV === "production" ? "secondary-storage" : "memory",
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
      trustedProviders: ["github", "apple"],
    },
    skipStateCookieCheck: true,
  },
  socialProviders: {
    github: {
      enabled: true,
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
    },
    apple: {
      enabled: true,
      clientId: config.APPLE_CLIENT_ID,
      clientSecret: appleClientSecret,
      appBundleIdentifier: MOBILE_APP_BUNDLE_ID,
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
        type: SUBSCRIPTION_STATUSES as unknown as string[],
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    openAPI(),
    expo(),
    admin(),
    consentEventsPlugin(),
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        const anonymousUserId = anonymousUser.user.id;
        const newUserId = newUser.user.id;

        logger.info(
          {
            event: "anonymous_link_account.start",
            category: LogCategory.AUTH,
            anonymousUserId,
            newUserId,
          },
          "Linking anonymous account..."
        );

        const [newUserDb] = await db
          .select({ dbName: databases.db_name })
          .from(databases)
          .where(eq(databases.user_id, newUserId));

        // Swap database ownership and migrate revlogs atomically
        await db.transaction(async (tx) => {
          if (newUserDb) {
            await tx.delete(databases).where(eq(databases.user_id, newUserId));
          }

          await tx
            .update(databases)
            .set({ user_id: newUserId })
            .where(eq(databases.user_id, anonymousUserId));

          await tx
            .update(revlogs)
            .set({ user_id: newUserId })
            .where(eq(revlogs.user_id, anonymousUserId));
        });

        // Clean up the orphaned Turso database (non-critical — if this fails,
        // the DB is empty and can be cleaned up later)
        if (newUserDb) {
          try {
            await tursoPlatformClient.databases.delete(newUserDb.dbName);
          } catch (error) {
            logger.warn(
              {
                event: "anonymous_link_account.turso_cleanup_failed",
                category: LogCategory.AUTH,
                dbName: newUserDb.dbName,
                error,
              },
              "Failed to delete orphaned Turso database"
            );
          }
        }

        logger.info(
          {
            event: "anonymous_link_account.end",
            category: LogCategory.AUTH,
            anonymousUserId,
            newUserId,
          },
          "Linked anonymous account."
        );
      },
    }),
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
          successUrl: `https://${config.WEB_CLIENT_DOMAIN}/checkout-success`,
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
              plan,
              productId: product.id,
              status,
            });

            if (plan === null) {
              childLogger.error(
                {
                  event: "webhook_subscription_updated",
                },
                "Unknown Polar product ID, cannot determine plan"
              );

              throw new Error(
                `Unknown Polar product ID: ${product.id}. Cannot determine plan.`
              );
            }

            const existingUser = await resolveLocalUserForPolarCustomer({
              customerId,
              externalId: customer.externalId,
              email: customer.email,
              logger: childLogger,
            });

            if (!existingUser) {
              childLogger.error(
                {
                  event: "webhook_subscription_updated.user_not_found",
                  customerEmail: customer.email,
                },
                "No local user matches the Polar customer."
              );

              throw new Error(
                `No local user found for Polar customer ${customerId} (externalId: ${customer.externalId ?? "null"}, email: ${customer.email ?? "null"})`
              );
            }

            if (!isSubscriptionStatus(status)) {
              childLogger.error(
                {
                  event: "webhook_subscription_updated.unknown_status",
                },
                "Unknown Polar subscription status, cannot persist"
              );

              throw new Error(`Unknown Polar subscription status: ${status}`);
            }

            childLogger.info({
              event: "webhook_subscription_active.start",
            });

            await db
              .update(users)
              .set({
                plan,
                subscriptionStatus: status,
              })
              .where(eq(users.id, existingUser.id));

            const userSessions = await db
              .select({ token: sessions.token })
              .from(sessions)
              .where(eq(sessions.userId, existingUser.id));

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
 * Resolves the local user for a Polar customer. Falls back to email-matching
 * when `externalId` is missing (e.g. the customer was created via a raw Polar
 * checkout link rather than through the Better-Auth plugin). When a match is
 * found via email, the Polar customer is backfilled with the local user's ID
 * so subsequent webhooks use the fast path.
 */
const resolveLocalUserForPolarCustomer = async ({
  customerId,
  externalId,
  email,
  logger: childLogger,
}: {
  customerId: string;
  externalId: string | null | undefined;
  email: string | null | undefined;
  logger: typeof logger;
}): Promise<{ id: string } | null> => {
  if (externalId) {
    const [matchedByExternalId] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, externalId));

    if (matchedByExternalId) {
      return matchedByExternalId;
    }

    childLogger.warn(
      {
        event: "webhook_subscription_updated.external_id_orphan",
        externalId,
      },
      "Polar customer has externalId but no local user matches; falling back to email."
    );
  }

  if (!email) {
    return null;
  }

  const [matchedByEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!matchedByEmail) {
    return null;
  }

  childLogger.info(
    {
      event: "webhook_subscription_updated.email_match",
      matchedUserId: matchedByEmail.id,
    },
    "Matched Polar customer to local user by email; backfilling externalId on Polar."
  );

  try {
    await polarClient.customers.update({
      id: customerId,
      customerUpdate: { externalId: matchedByEmail.id },
    });
  } catch (error) {
    childLogger.error(
      {
        event: "webhook_subscription_updated.polar_update_failed",
        error,
      },
      "Failed to backfill externalId on Polar customer."
    );

    throw error;
  }

  return matchedByEmail;
};

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
