import { OAuth2RequestError, generateState } from "arctic";
import express, { type Router } from "express";
import { github, lucia } from "../../auth";
import { serializeCookie } from "oslo/cookie";
import { db } from "../../db";
import { users } from "../../db/schema/users";
import { eq, or } from "drizzle-orm";
import { generateId } from "lucia";

interface GitHubUser {
  id: number;
  login: string;
  email: string;
}

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

  const DOMAIN = process.env.WEB_CLIENT_DOMAIN!;
  const isLocal = DOMAIN.includes("localhost");

  const redirectUrl = `${isLocal ? "http" : "https"}://${DOMAIN}`;

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
        .redirect(redirectUrl);
    }

    const userId = generateId(15);

    await db.insert(users).values({
      id: userId,
      github_id: githubUser.id,
      username: githubUser.login,
      email: githubUser.email,
    });

    // TODO: Create meilisearch index for the user

    const session = await lucia.createSession(userId, {} as any);

    return res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize(),
      )
      .redirect(redirectUrl);
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
