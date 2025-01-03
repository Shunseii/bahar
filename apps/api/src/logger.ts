import pino from "pino";
import { config } from "./config";
import pinoHttp from "pino-http";
import crypto from "crypto";

export const logger = pino({
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    // req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  transport:
    config.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "yyyy-mm-dd HH:MM:ss.l o",
            messageFormat: "{msg}",
            ignore:
              "pid,hostname,app,version,environment,req.headers,context,req.url",
            levelFirst: true,
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: {
    app: config.APP_NAME,
    version: "1.0.0",
    environment: config.NODE_ENV || "development",
  },
});

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existingId = req.id ?? req.headers["x-request-id"];

    if (existingId) {
      return existingId;
    }

    const id = crypto.randomUUID();

    res.setHeader("X-Request-Id", id);

    return id;
  },
  customProps: () => ({
    context: "http",
  }),
  customLogLevel: (_req, res, err) => {
    if (err) return "error";

    if (res.statusCode >= 500) return "error";

    return "info";
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      path: req.url.split("?")[0],
      query: req.query,
      parameters: req.params,
      headers: {
        "user-agent": req.headers["user-agent"],
        "content-length": req.headers["content-length"],
        accept: req.headers.accept,
        referer: req.headers.referer,
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

/**
 * Creates child logger for a given module.
 * Adds the module name to the logger's context.
 */
export const createModuleLogger = (moduleName: string) => {
  return logger.child({ module: moduleName });
};
