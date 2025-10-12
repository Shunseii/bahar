import pino from "pino";
import { config } from "./config";
import pinoHttp from "pino-http";
import { AsyncLocalStorage } from "async_hooks";

interface TraceContext {
  traceId?: string;
  userId?: string;
  sessionId?: string;
  seqNum: number;
}

export const traceContext = new AsyncLocalStorage<TraceContext>();

export const getTraceContext = (): TraceContext => {
  const context = traceContext.getStore();

  if (!context) {
    return {
      seqNum: 0,
    };
  }

  return context;
};

export const enum LogCategory {
  AUTH = "auth",
  DATABASE = "database",
  APPLICATION = "application",
}

export const logger = pino({
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin: () => {
    const context = getTraceContext();

    context.seqNum++;

    return {
      traceId: context.traceId,
      seqNum: context.seqNum,
      userId: context.userId,
      sessionId: context.sessionId,
    };
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
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
              "pid,hostname,app,version,environment,context,req.url,req.headers",
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
  autoLogging: {
    ignore: (req) => req.method === "OPTIONS" || req.url === "/health",
  },
  customReceivedMessage: () => {
    return "request received";
  },
  customLogLevel: (_req, res, err) => {
    if (err) return "error";

    if (res.statusCode >= 500) return "error";

    return "info";
  },
  customReceivedObject: () => {
    return {
      category: LogCategory.APPLICATION,
      event: "request_received",
    };
  },
  customSuccessObject: (_req, _res, val) => {
    return {
      ...val,
      category: LogCategory.APPLICATION,
      event: "request_processed",
    };
  },
  customErrorObject: (_req, _res, _error, val) => {
    return {
      ...val,
      category: LogCategory.APPLICATION,
      event: "request_failed",
    };
  },
  serializers: {
    req: (req) => ({
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
