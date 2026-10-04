import type { Logger } from "pino";

/**
 * Categorizes an OTP endpoint result for telemetry. better-auth returns
 * APIError-shaped objects (statusCode + body) from its endpoints; the
 * after-hook receives them via `ctx.context.returned`. Without this
 * classification, OTP rejections were invisible in Sentry -- the user's
 * most-reported instability ("invalid OTP once, then works") produced
 * zero failure events in 90 days of telemetry.
 *
 * Returns null for successful responses so callers can fall through to
 * their success-path logging.
 */
export type OtpFailure = {
  statusCode: number;
  code: string | null;
  reason: string;
};

export const describeOtpFailure = (returned: unknown): OtpFailure | null => {
  if (!(returned instanceof Error)) return null;
  if (!("statusCode" in returned)) return null;

  const apiError = returned as {
    statusCode: number;
    body?: { message?: string; code?: string };
    message: string;
  };

  return {
    statusCode: apiError.statusCode,
    code: apiError.body?.code ?? null,
    reason: apiError.body?.message ?? apiError.message,
  };
};

/** OTP paths whose failures must reach telemetry. */
export const OTP_PATHS: readonly string[] = [
  "/email-otp/send-verification-otp",
  "/email-otp/verify-email",
  "/sign-in/email-otp",
];
type LoggerLike = Pick<Logger, "warn">;

/**
 * Logs an OTP rejection at warn level with its reason. Called from the
 * better-auth after-hook for every OTP-path failure.
 */
export const logOtpFailure = ({
  authLogger,
  path,
  returned,
}: {
  authLogger: LoggerLike;
  path: string;
  returned: unknown;
}): boolean => {
  const failure = describeOtpFailure(returned);
  if (!failure) return false;

  authLogger.warn(
    {
      event: "otp_request_failed",
      path,
      statusCode: failure.statusCode,
      code: failure.code,
      reason: failure.reason,
    },
    "OTP request rejected."
  );
  return true;
};
