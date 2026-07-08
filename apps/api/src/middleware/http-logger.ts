import { Elysia } from "elysia";
import { LogCategory, logger } from "../utils/logger";

/**
 * Resolves the HTTP status code from an Elysia response.
 *
 * Two response shapes reach `onAfterResponse`:
 *  - a native `Response` (e.g. from a mounted better-auth handler) exposes
 *    `status`
 *  - an `ElysiaCustomStatusResponse` produced by `status(4xx)` in a macro
 *    exposes `code` (not `status`)
 *
 * We check both, then fall back to `set.status`, so 401/403/429 responses are
 * logged with their real status instead of defaulting to 200.
 */
const resolveStatus = (response: unknown, setStatus: unknown): number => {
  const fromResponse = (response as { status?: unknown; code?: unknown }) ?? {};

  if (typeof fromResponse.status === "number") return fromResponse.status;
  if (typeof fromResponse.code === "number") return fromResponse.code;
  if (typeof setStatus === "number") return setStatus;

  return 200;
};

/**
 * Custom HTTP logging middleware that replicates pino-http functionality.
 *
 * Fields are emitted flat (method, path, status, route, responseTime) so they
 * survive forwarding to Sentry Logs as searchable attributes. Request headers,
 * query params and bodies are deliberately not logged to stay PII-safe.
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
        method: request.method,
        path,
      },
      "request received"
    );
  })
  .onAfterResponse(
    { as: "global" },
    ({ request, requestPath, requestStartTime, response, route, set }) => {
      if (request.method === "OPTIONS" || requestPath === "/health") return;

      const duration = Date.now() - requestStartTime;
      const status = resolveStatus(response, set.status);
      const level = status >= 500 ? "error" : "info";

      logger[level](
        {
          category: LogCategory.APPLICATION,
          event: "request_processed",
          method: request.method,
          path: requestPath,
          route,
          status,
          responseTime: duration,
        },
        "request completed"
      );
    }
  )
  .onError(
    ({ request, requestPath, error, code, route, requestStartTime, set }) => {
      if (request.method === "OPTIONS" || requestPath === "/health") return;

      const duration = Date.now() - (requestStartTime ?? Date.now());

      // Map Elysia error codes to HTTP status codes
      const status =
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

      const level = status >= 500 ? "error" : "warn";

      logger[level](
        {
          category: LogCategory.APPLICATION,
          event: "request_failed",
          method: request.method,
          path: requestPath,
          route,
          status,
          responseTime: duration,
          code,
          err: code !== "NOT_FOUND" ? error : undefined,
        },
        "request failed"
      );
    }
  );
