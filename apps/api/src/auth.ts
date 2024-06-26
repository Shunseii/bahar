import { Lucia } from "lucia";
import { adapter } from "./db";
import type { User as LuciaUser, Session as LuciaSession } from "lucia";
import { User } from "./db/schema/users";
import { Session } from "./db/schema/sessions";
import { GitHub } from "arctic";
import type { IncomingMessage, ServerResponse } from "http";

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },

  getUserAttributes: (attributes) => {
    // Attributes are the fields directly from the database
    return {
      githubId: attributes.github_id,
      username: attributes.username,
      email: attributes.email,
    };
  },
});

export const validateRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<
  { user: LuciaUser; session: LuciaSession } | { user: null; session: null }
> => {
  const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");

  if (!sessionId) {
    return {
      user: null,
      session: null,
    };
  }

  const result = await lucia.validateSession(sessionId);

  if (result.session && result.session.fresh) {
    res.appendHeader(
      "Set-Cookie",
      lucia.createSessionCookie(result.session.id).serialize(),
    );
  }

  if (!result.session) {
    res.appendHeader(
      "Set-Cookie",
      lucia.createBlankSessionCookie().serialize(),
    );
  }

  return result;
};

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
);

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: User;
    DatabaseSessionAttributes: Session;
  }
}
