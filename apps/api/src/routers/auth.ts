import { OAuth2RequestError, generateState } from "arctic";
import express, { type Router } from "express";
import { github, lucia } from "../auth.js";
import { serializeCookie } from "oslo/cookie";
import { db } from "../db/index.js";
import { users } from "../db/schema/users.js";
import { eq, or } from "drizzle-orm";
import { TimeSpan, generateId } from "lucia";
import {
  otpLimitProcedure,
  protectedProcedure,
  publicProcedure,
  signUpLimitProcedure,
  router as trpcRouter,
} from "../trpc.js";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { TOTPController } from "oslo/otp";
import { HMAC } from "oslo/crypto";
import { sendMail } from "../mail.js";
import { redisClient } from "../redis.js";
import { base64 } from "oslo/encoding";

interface GitHubUser {
  id: number;
  login: string;
  email: string;
}

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
      const totpController = new TOTPController({
        digits: 6,
        period: new TimeSpan(30, "s"),
      });
      const secret = await new HMAC("SHA-1").generateKey();
      const otp = await totpController.generate(secret);

      const base64Secret = base64.encode(new Uint8Array(secret));

      // Store otp and secret so we can access it in another route
      await redisClient.hset(otp, { base64Secret, email });
      await redisClient.expire(otp, 30);

      // TODO: Translate this
      sendMail({
        to: email,
        from: "no-reply@bahar.dev",
        subject: "Login | Bahar",
        text: `Enter this code: ${otp}. This code only lasts for 30 seconds.`,
        html: `Enter this code: <strong>${otp}</strong>. This code only lasts for 30 seconds.`,
      });

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

      if (!!existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "email_in_use",
        });
      }

      // Create TOTP
      const totpController = new TOTPController({
        digits: 6,
        period: new TimeSpan(30, "s"),
      });
      const secret = await new HMAC("SHA-1").generateKey();
      const otp = await totpController.generate(secret);

      const base64Secret = base64.encode(new Uint8Array(secret));

      // Store otp and secret so we can access it in another route
      await redisClient.hset(otp, { base64Secret, email, username });
      await redisClient.expire(otp, 30);

      // TODO: Translate this
      sendMail({
        to: email,
        from: "no-reply@bahar.dev",
        subject: "Sign Up | Bahar",
        text: `Enter this code: ${otp}. This code only lasts for 30 seconds.`,
        html: `Enter this code: <strong>${otp}</strong>. This code only lasts for 30 seconds.`,
      });

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
      const totpController = new TOTPController({
        digits: 6,
        period: new TimeSpan(30, "s"),
      });
      const secret = await new HMAC("SHA-1").generateKey();
      const otp = await totpController.generate(secret);

      const base64Secret = base64.encode(new Uint8Array(secret));

      // Store otp and secret so we can access it in another route
      await redisClient.hset(otp, { base64Secret, email, username });
      await redisClient.expire(otp, 30);

      // TODO: Translate this
      sendMail({
        to: email,
        from: "no-reply@bahar.dev",
        subject: "Sign Up | Bahar",
        text: `Enter this code: ${otp}. This code only lasts for 30 seconds.`,
        html: `Enter this code: <strong>${otp}</strong>. This code only lasts for 30 seconds.`,
      });

      return true;
    }),

  validateLoginOTP: publicProcedure
    .input(
      z.object({ code: z.string().length(6, { message: "invalid_code" }) }),
    )
    .mutation(async ({ ctx, input: { code } }) => {
      const totpController = new TOTPController();
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

      const codeIsValid = await totpController.verify(code, secret);

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
      const totpController = new TOTPController();
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

      if (!!existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "email_in_use",
        });
      }

      const secret = base64.decode(base64Secret);

      const codeIsValid = await totpController.verify(code, secret);

      if (!codeIsValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That code is not valid.",
        });
      }

      const userId = generateId(15);

      await db.insert(users).values({
        id: userId,
        username,
        email,
      });

      const session = await lucia.createSession(userId, {} as any);

      setHeaders(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize(),
      );

      return true;
    }),
});

export const authRouter: Router = express.Router();

authRouter.get("/login/github", async (_req, res) => {
  const state = generateState();
  const url = await github.createAuthorizationURL(state);

  res
    .appendHeader(
      "Set-Cookie",
      serializeCookie("github_oauth_state", state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "lax",
      }),
    )
    .redirect(url.toString());
});

authRouter.get("/login/github/callback", async (req, res) => {
  const code = req.query.code?.toString() ?? null;
  const state = req.query.state?.toString() ?? null;
  const storedState = req.cookies.github_oauth_state ?? null;

  if (!code || !state || !storedState || state !== storedState) {
    res.status(400).end();
    return;
  }

  try {
    const tokens = await github.validateAuthorizationCode(code);
    const githubUserResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });
    const githubUser = (await githubUserResponse.json()) as GitHubUser;

    const existingUser = (
      await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.github_id, githubUser.id),
            eq(users.email, githubUser.email),
          ),
        )
    )[0];

    if (existingUser) {
      const session = await lucia.createSession(existingUser.id, {} as any);

      // If user signed up through another method,
      // we automatically link their github account
      if (!existingUser.github_id) {
        await db
          .update(users)
          .set({ github_id: githubUser.id })
          .where(eq(users.id, existingUser.id));
      }

      return res
        .appendHeader(
          "Set-Cookie",
          lucia.createSessionCookie(session.id).serialize(),
        )
        .redirect(process.env.WEB_CLIENT_BASE_URL!);
    }

    const userId = generateId(15);

    await db.insert(users).values({
      id: userId,
      github_id: githubUser.id,
      username: githubUser.login,
      email: githubUser.email,
    });

    const session = await lucia.createSession(userId, {} as any);

    return res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize(),
      )
      .redirect(process.env.WEB_CLIENT_BASE_URL!);
  } catch (err) {
    if (err instanceof OAuth2RequestError) {
      // Invalid code
      return new Response(null, {
        status: 400,
      });
    }

    res.status(500).end();
    return;
  }
});
