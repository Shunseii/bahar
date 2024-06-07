import { NextFunction, Request, Response } from "express";
import { verifyRequestOrigin } from "oslo/request";
import { getAllowedDomains } from "./utils.js";

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
