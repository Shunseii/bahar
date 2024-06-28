import { NextFunction, Request, RequestHandler, Response } from "express";
import { verifyRequestOrigin } from "oslo/request";
import { getAllowedDomains } from "./utils";
import { validateRequest } from "./auth";

export const csrf = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET") {
    return next();
  }

  const originHeader = req.headers.origin ?? null;
  const hostHeader =
    ((req.headers.host ?? req.headers["X-Forwarded-Host"]) as string) ?? null;

  const allowedDomains = [
    hostHeader,
    ...getAllowedDomains(process.env.WEB_CLIENT_DOMAIN!),
  ];

  if (
    !originHeader ||
    !hostHeader ||
    !verifyRequestOrigin(originHeader, allowedDomains)
  ) {
    return res.status(403).end();
  }

  return next();
};

export const auth: RequestHandler = async (req, res, next) => {
  const { session, user } = await validateRequest(req, res);

  if (!session || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = user;
  req.session = session;

  return next();
};
