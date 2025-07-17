import { betterAuth } from "better-auth";
import { createAuthMiddleware, emailOTP, openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { users, verifications, sessions, accounts } from "./db/schema/auth";
import { sendMail } from "./clients/mail";
import { getAllowedDomains } from "./utils";
import { config } from "./config";
import { redisClient } from "./clients/redis";
import { createUserIndex } from "./clients/meilisearch";
import { LogCategory, logger } from "./logger";

const APP_NAME = "Bahar";
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECS = 60 * 5; // 5 minutes
const SESSION_COOKIE_CACHE_EXPIRY_SECS = 60 * 5; // 5 minutes

const allowedDomains = getAllowedDomains([config.WEB_CLIENT_DOMAIN]);

export const auth = betterAuth({
  trustedOrigins: allowedDomains,
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
          "There was an unexpected error.",
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
          "Getting user session...",
        );
      } else if (path === "/email-otp/send-verification-otp") {
        authLogger.info(
          {
            event: "send_verification_otp_email.start",
            body: ctx.body,
          },
          "Sending verification otp email...",
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
          "Verifying email otp...",
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
          "Signing in with email otp...",
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
          "Retrieved user session.",
        );
      } else if (path === "/email-otp/send-verification-otp") {
        authLogger.info(
          {
            event: "send_verification_otp_email.end",
          },
          "Sent verification otp email.",
        );
      } else if (path === "/email-otp/verify-email") {
        authLogger.info(
          {
            event: "verify_email.end",
          },
          "Verified email otp.",
        );
      } else if (path === "/sign-in/email-otp") {
        authLogger.info(
          {
            event: "login_email_otp.end",
          },
          "Signed in with email otp.",
        );
      }
    }),
  },
  logger: {
    disabled: true,
    level: "debug",
    log: (level, message, ...args) => {
      // TODO: refactor this once the following PR has been addressed
      // https://github.com/better-auth/better-auth/issues/1115
      const ANSI_ESCAPE_REGEXP = new RegExp(String.raw`\u001b\[\d+m`);

      /**
       * Better auth passes us a formatted message but
       * we just want the raw message since pino will
       * handle formatting.
       */
      const unformattedMessage = message
        ?.split?.("[Better Auth]:")?.[1]
        ?.replace(ANSI_ESCAPE_REGEXP, "")
        ?.trim();

      const mergedArgs = args.reduce((acc, curr) => ({ ...acc, ...curr }), {});

      logger[level](mergedArgs, unformattedMessage);
    },
  },
  secondaryStorage: {
    // TODO: add trace ids to these logs
    // Upstash client will automatically deserialize JSON strings
    get: async (key) => {
      logger.debug(
        { key, category: LogCategory.DATABASE, event: "redis_get" },
        "Better auth get from redis.",
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
        "Better auth set to redis.",
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
        "Better auth delete from redis.",
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
  },
  plugins: [
    openAPI(),
    emailOTP({
      otpLength: OTP_LENGTH,
      expiresIn: OTP_EXPIRY_SECS,
      disableSignUp: false,
      sendVerificationOTP: async ({ email, otp }) => {
        // TODO: Translate this
        await sendMail({
          to: email,
          from: "Bahar <no-reply@auth.bahar.dev>",
          subject: "Login | Bahar",
          text: `Enter this code: ${otp}. This code only lasts for 5 minutes.`,
          html: `Enter this code: <strong>${otp}</strong>. This code only lasts for 5 minutes.`,
        });
      },
    }),
  ],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
    // TODO: figure out why I need to pass these explicitly here
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
            "Creating account...",
          );
        },
        after: async (account) => {
          logger.info(
            {
              accountId: account.id,
              category: LogCategory.DATABASE,
              event: "account_create.end",
            },
            "Created account.",
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
            "Creating session...",
          );
        },
        after: async (session) => {
          logger.info(
            {
              sessionId: session.id,
              category: LogCategory.DATABASE,
              event: "session_create.end",
            },
            "Created session.",
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
            "Creating user...",
          );
        },
        after: async (user) => {
          logger.info(
            {
              userId: user.id,
              category: LogCategory.DATABASE,
              event: "user_create.end",
            },
            "Created user.",
          );

          // Set the index name to the user's id.
          await createUserIndex(user.id);
        },
      },
    },
  },
});

export type Session = (typeof auth.$Infer.Session)["session"];
export type User = (typeof auth.$Infer.Session)["user"];
