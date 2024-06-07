import { NextFunction, Request, Response } from "express";
import { verifyRequestOrigin } from "oslo/request";

export const csrf = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET") {
    return next();
  }

  const originHeader = req.headers.origin ?? null;
  const hostHeader =
    ((req.headers.host ?? req.headers["X-Forwarded-Host"]) as string) ?? null;

  const DOMAIN = process.env.WEB_CLIENT_DOMAIN!;
  const isLocal = DOMAIN.includes("localhost");
  const protocol = isLocal ? "http" : "https";

  const allowedDomains: string[] = [
    hostHeader,
    `${protocol}://${DOMAIN}`,
    `${protocol}://www.${DOMAIN}`,
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
