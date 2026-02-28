import { Elysia } from "elysia";
import { LogCategory, logger } from "../utils/logger";

/**
 * Custom HTTP logging middleware that replicates pino-http functionality.
 */
export const httpLogger = new Elysia({ name: "http-logger" })
  .derive({ as: "global" }, ({ request }) => ({
    requestStartTime: Date.now(),
    requestPath: new URL(request.url).pathname,
  }))
  .onRequest(({ request }) => {
    const path = new URL(request.url).pathname;
    if (request.method === "OPTIONS" || path === "/health") return;

    logger.info(
      {
        category: LogCategory.APPLICATION,
        event: "request_received",
        req: serializeRequest(request),
      },
      "request received"
    );
  })
  .onAfterResponse(
    { as: "global" },
    ({ request, requestPath, requestStartTime, response }) => {
      if (request.method === "OPTIONS" || requestPath === "/health") return;

      const duration = Date.now() - requestStartTime;
      const status = response?.status ?? 200;
      const level = status >= 500 ? "error" : "info";

      logger[level](
        {
          category: LogCategory.APPLICATION,
          event: "request_processed",
          responseTime: duration,
          req: serializeRequest(request),
          res: { statusCode: status },
        },
        "request completed"
      );
    }
  )
  .onError(({ request, requestPath, error, code, requestStartTime, set }) => {
    if (request.method === "OPTIONS" || requestPath === "/health") return;

    const duration = Date.now() - (requestStartTime ?? Date.now());

    // Map Elysia error codes to HTTP status codes
    const statusCode =
      code === "NOT_FOUND"
        ? 404
        : code === "VALIDATION"
          ? 400
          : code === "PARSE"
            ? 400
            : code === "INVALID_COOKIE_SIGNATURE"
              ? 400
              : typeof set.status === "number"
                ? set.status
                : 500;

    const level = statusCode >= 500 ? "error" : "warn";

    logger[level](
      {
        category: LogCategory.APPLICATION,
        event: "request_failed",
        responseTime: duration,
        req: serializeRequest(request),
        res: { statusCode },
        err: code !== "NOT_FOUND" ? error : undefined,
      },
      "request failed"
    );
  });

export function serializeRequest(request: Request) {
  const url = new URL(request.url);

  return {
    method: request.method,
    url: request.url,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: {
      "user-agent": request.headers.get("user-agent"),
      "content-length": request.headers.get("content-length"),
      accept: request.headers.get("accept"),
      referer: request.headers.get("referer"),
    },
  };
}
