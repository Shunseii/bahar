import { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { Session, User, auth as authClient } from "./auth";

export const auth: RequestHandler = async (req, res, next) => {
  const { api } = authClient;

  const { user, session } = (await api.getSession({
    headers: fromNodeHeaders(req.headers),
  })) as { session: Session; user: User };

  if (!session || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = user;
  req.session = session;

  return next();
};
