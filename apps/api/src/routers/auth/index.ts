import { lucia } from "../../auth";
import { db } from "../../db";
import { users } from "../../db/schema/users";
import { eq, or } from "drizzle-orm";
import { generateIdFromEntropySize } from "lucia";
import {
  otpLimitProcedure,
  protectedProcedure,
  publicProcedure,
  signUpLimitProcedure,
  router as trpcRouter,
} from "../../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sendMail } from "../../clients/mail";
import { redisClient } from "../../clients/redis";
import { base64 } from "oslo/encoding";
import { OTP_VALID_PERIOD, generateOTP, verifyOTP } from "../../otp/totp";
import { createUserIndex } from "../../clients/meilisearch";

/**
 * A buffer added to the redis ttl for otp
 * secrets, in seconds.
 */
const REDIS_OTP_TTL_BUFFER = 15;

export const trpcAuthRouter = trpcRouter({
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await lucia.invalidateSession(ctx.session.id);

    const { setHeaders } = ctx;

    setHeaders("Set-Cookie", lucia.createBlankSessionCookie().serialize());

    return;
  }),

  login: signUpLimitProcedure
    .input(z.object({ email: z.string().email().min(5).max(256) }))
    .mutation(async ({ input: { email } }) => {
      const existingUser = (
        await db
          .select()
          .from(users)
          .where(or(eq(users.email, email)))
      )[0];

      if (!existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "incorrect_email",
        });
      }

      // Create TOTP
      const { secret, otp } = await generateOTP();

      const base64Secret = base64.encode(new Uint8Array(secret));

      // TODO: Translate this
      sendMail({
        to: email,
        from: "no-reply@bahar.dev",
        subject: "Login | Bahar",
        text: `Enter this code: ${otp}. This code only lasts for 30 seconds.`,
        html: `Enter this code: <strong>${otp}</strong>. This code only lasts for 30 seconds.`,
      });

      // Store otp and secret so we can access it in another route
      await redisClient.hset(otp, { base64Secret, email });
      await redisClient.expire(
        otp,
        OTP_VALID_PERIOD.seconds() + REDIS_OTP_TTL_BUFFER,
      );

      return true;
    }),

  signUp: signUpLimitProcedure
    .input(
      z.object({
        username: z.string(),
        email: z.string().email().min(5).max(256),
      }),
    )
    .mutation(async ({ input: { email, username } }) => {
      const existingUser = (
        await db.select().from(users).where(eq(users.email, email)).limit(1)
      )[0];

      if (existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "email_in_use",
        });
      }

      // Create TOTP
      const { secret, otp } = await generateOTP();

      const base64Secret = base64.encode(new Uint8Array(secret));

      // TODO: Translate this
      sendMail({
        to: email,
        from: "no-reply@bahar.dev",
        subject: "Sign Up | Bahar",
        text: `Enter this code: ${otp}. This code only lasts for 30 seconds.`,
        html: `Enter this code: <strong>${otp}</strong>. This code only lasts for 30 seconds.`,
      });

      // Store otp and secret so we can access it in another route
      await redisClient.hset(otp, { base64Secret, email, username });
      await redisClient.expire(
        otp,
        OTP_VALID_PERIOD.seconds() + REDIS_OTP_TTL_BUFFER,
      );

      return true;
    }),

  // TODO: use on the client
  resendOTP: otpLimitProcedure
    .input(
      z.object({
        username: z.string().optional(),
        email: z.string().email().min(5).max(256),
      }),
    )
    .mutation(async ({ input: { email, username } }) => {
      // Create TOTP
      const { secret, otp } = await generateOTP();

      const base64Secret = base64.encode(new Uint8Array(secret));

      // TODO: Translate this
      sendMail({
        to: email,
        from: "no-reply@bahar.dev",
        subject: "Sign Up | Bahar",
        text: `Enter this code: ${otp}. This code only lasts for 30 seconds.`,
        html: `Enter this code: <strong>${otp}</strong>. This code only lasts for 30 seconds.`,
      });

      // Store otp and secret so we can access it in another route
      await redisClient.hset(otp, { base64Secret, email, username });
      await redisClient.expire(otp, 45);

      return true;
    }),

  validateLoginOTP: publicProcedure
    .input(
      z.object({ code: z.string().length(6, { message: "invalid_code" }) }),
    )
    .mutation(async ({ ctx, input: { code } }) => {
      const val = await redisClient.hgetall(code);

      const isEmpty = !val || Object.keys(val).length === 0;

      if (isEmpty) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "expired_code",
        });
      }

      const { email, base64Secret } = val as {
        base64Secret: string;
        email: string;
      };

      const secret = base64.decode(base64Secret);

      const codeIsValid = await verifyOTP({ otp: code, secret });

      if (!codeIsValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That code is not valid.",
        });
      }

      const existingUser = (
        await db
          .select()
          .from(users)
          .where(or(eq(users.email, email)))
      )[0];

      const session = await lucia.createSession(existingUser.id, {} as any);

      ctx.setHeaders(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize(),
      );

      return true;
    }),

  validateOTP: publicProcedure
    .input(
      z.object({
        code: z.string().length(6, { message: "invalid_code" }),
      }),
    )
    .mutation(async ({ ctx: { setHeaders }, input: { code } }) => {
      const val = await redisClient.hgetall(code);

      const isEmpty = !val || Object.keys(val).length === 0;

      if (isEmpty) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "expired_code",
        });
      }

      const { email, username, base64Secret } = val as {
        email: string;
        username: string;
        base64Secret: string;
      };

      const existingUser = (
        await db.select().from(users).where(eq(users.email, email)).limit(1)
      )[0];

      if (existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "email_in_use",
        });
      }

      const secret = base64.decode(base64Secret);

      const codeIsValid = await verifyOTP({ otp: code, secret });

      if (!codeIsValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That code is not valid.",
        });
      }

      try {
        const userId = generateIdFromEntropySize(10);

        await db.insert(users).values({
          id: userId,
          username,
          email,
        });

        await createUserIndex(userId);

        const session = await lucia.createSession(userId, {} as any);

        setHeaders(
          "Set-Cookie",
          lucia.createSessionCookie(session.id).serialize(),
        );

        return true;
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Something went wrong.",
        });
      }
    }),
});
