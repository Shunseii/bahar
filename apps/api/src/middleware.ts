import { NextFunction, RequestHandler, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { Session, User, auth as authClient } from "./auth";
import crypto from "crypto";
import { getTraceContext, traceContext } from "./utils/logger";

export const auth: RequestHandler = async (req, res, next) => {
  const { api } = authClient;

  const { user, session } = (await api.getSession({
    headers: fromNodeHeaders(req.headers),
  })) as { session: Session; user: User };

  if (!session || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const context = getTraceContext();

  context.userId = user.id;
  context.sessionId = session.id;

  req.user = user;
  req.session = session;

  return next();
};

/**
 * Middleware that adds the trace id to async local storage
 * context. This should be used as the first middleware so all
 * subsequent code has access to the trace id.
 */
export const traceContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const existingId = (req.id ?? req.headers["x-request-id"]) as string | null;
  const traceId = existingId || crypto.randomUUID();

  res.setHeader("X-Request-Id", traceId);

  req.id = traceId;

  // Run the entire request in the trace context
  traceContext.run(
    {
      traceId,
      seqNum: 0,
    },
    next,
  );
};
