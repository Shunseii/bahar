import { AsyncLocalStorage } from "node:async_hooks";
import pino from "pino";
import { config } from "./config";

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

export enum LogCategory {
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
  },
  transport:
    config.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "yyyy-mm-dd HH:MM:ss.l o",
            messageFormat: "{msg}",
            ignore: "pid,hostname,app,version,environment,context,req.headers",
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

/**
 * Creates child logger for a given module.
 * Adds the module name to the logger's context.
 */
export const createModuleLogger = (moduleName: string) => {
  return logger.child({ module: moduleName });
};
