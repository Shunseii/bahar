import { AsyncLocalStorage } from "node:async_hooks";
import * as Sentry from "@sentry/bun";
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

const sentryLogMethods: Record<
  string,
  (message: string, attributes?: Record<string, unknown>) => void
> = {
  trace: Sentry.logger.trace,
  debug: Sentry.logger.debug,
  info: Sentry.logger.info,
  warn: Sentry.logger.warn,
  error: Sentry.logger.error,
  fatal: Sentry.logger.fatal,
};

const isPrimitive = (
  value: unknown
): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

/**
 * Sentry log attributes are only searchable when they are flat, primitive
 * top-level keys. Nested objects (e.g. `req.path`, `res.statusCode`) get
 * stringified into a single opaque attribute and can't be filtered on, so we
 * flatten them into dot-notation keys before forwarding. Arrays and other
 * non-primitives are dropped to keep attributes flat and low-noise.
 */
const flattenLogAttributes = (
  input: Record<string, unknown>,
  prefix = "",
  out: Record<string, string | number | boolean> = {}
): Record<string, string | number | boolean> => {
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;

    const attributeKey = prefix ? `${prefix}.${key}` : key;

    if (isPrimitive(value)) {
      out[attributeKey] = value;
    } else if (value instanceof Error) {
      out[attributeKey] = value.message;
    } else if (typeof value === "object" && !Array.isArray(value)) {
      flattenLogAttributes(value as Record<string, unknown>, attributeKey, out);
    }
  }

  return out;
};

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
  hooks: {
    logMethod(inputArgs, method, level) {
      const sentryLog = sentryLogMethods[this.levels.labels[level]];

      if (sentryLog) {
        const [first, second] = inputArgs;

        if (typeof first === "string") {
          sentryLog(first);
        } else if (first && typeof first === "object") {
          const message = typeof second === "string" ? second : "";
          sentryLog(
            message,
            flattenLogAttributes(first as Record<string, unknown>)
          );
        }
      }

      return method.apply(this, inputArgs);
    },
  },
});

/**
 * Creates child logger for a given module.
 * Adds the module name to the logger's context.
 */
export const createModuleLogger = (moduleName: string) => {
  return logger.child({ module: moduleName });
};
