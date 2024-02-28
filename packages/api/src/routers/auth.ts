import { OAuth2RequestError, generateState } from "arctic";
import express, { type Router } from "express";
import { github, lucia } from "../auth";
import { serializeCookie } from "oslo/cookie";
import { db } from "../db";
import { users } from "../db/schema/users";
import { eq } from "drizzle-orm";
import { generateId } from "lucia";
import { protectedProcedure, router as trpcRouter } from "../trpc";

interface GitHubUser {
  id: number;
  login: string;
  email: string;
}

export const trpcAuthRouter = trpcRouter({
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await lucia.invalidateSession(ctx.session.id);

    const { setCookie } = ctx;

    setCookie("Set-Cookie", lucia.createBlankSessionCookie().serialize());

    return;
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
    console.log(code, state, storedState);

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
    const githubUser: GitHubUser = await githubUserResponse.json();

    const existingUser = (
      await db.select().from(users).where(eq(users.github_id, githubUser.id))
    )[0];

    if (existingUser) {
      const session = await lucia.createSession(existingUser.id, {} as any);

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
