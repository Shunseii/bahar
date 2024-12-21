import { betterAuth } from "better-auth";
import { emailOTP, openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { users, verifications, sessions, accounts } from "./db/schema/auth";
import { sendMail } from "./clients/mail";
import { getAllowedDomains } from "./utils";
import { config } from "./config";
import { redisClient } from "./clients/redis";
import { createUserIndex } from "./clients/meilisearch";

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
  secondaryStorage: {
    // Upstash client will automatically deserialize JSON strings
    get: async (key) => {
      return await redisClient.get(key);
    },
    set: async (key, value, ttl) => {
      if (ttl) {
        await redisClient.set(key, JSON.stringify(value), { ex: ttl });
      } else {
        await redisClient.set(key, JSON.stringify(value));
      }
    },
    delete: async (key) => {
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
        console.log("Sending OTP to:", email);

        // TODO: Translate this
        await sendMail({
          to: email,
          from: "no-reply@bahar.dev",
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
    user: {
      create: {
        after: async (user) => {
          // Set the index name to the user's id.
          await createUserIndex(user.id);
        },
      },
    },
  },
});

export type Session = (typeof auth.$Infer.Session)["session"];
export type User = (typeof auth.$Infer.Session)["user"];
