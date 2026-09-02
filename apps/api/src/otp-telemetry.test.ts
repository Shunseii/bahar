import { describe, expect, mock, test } from "bun:test";
import { describeOtpFailure, logOtpFailure, OTP_PATHS } from "./otp-telemetry";

/**
 * The scenario behind this coverage (telemetry gap 1): a user's OTP sign-in
 * fails once transiently (rate limit, token expiry, cookie loss) then
 * succeeds on retry. Trace 575af4610ec0488de51b8231a041f56b showed exactly
 * this -- two sends 39s apart, then success -- with the failure between
 * them completely invisible. These tests pin down that every rejection
 * shape better-auth can produce is classified and logged.
 */

const makeApiError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), {
    statusCode,
    body: { message, code: message.toUpperCase().replace(/ /g, "_") },
    name: "APIError",
  });

describe("describeOtpFailure", () => {
  test("classifies an APIError returned from an OTP endpoint", () => {
    const failure = describeOtpFailure(makeApiError(429, "Too many requests"));

    expect(failure).toEqual({
      statusCode: 429,
      code: "TOO_MANY_REQUESTS",
      reason: "Too many requests",
    });
  });

  test("returns null for a successful (non-error) response", () => {
    expect(describeOtpFailure({ user: { id: "u1" } })).toBeNull();
  });

  test("returns null for a plain error without APIError shape", () => {
    expect(describeOtpFailure(new Error("internal"))).toBeNull();
  });

  test("falls back to the error's own message when body is absent", () => {
    const bare = Object.assign(new Error("Invalid code"), {
      statusCode: 400,
      name: "APIError",
    });

    expect(describeOtpFailure(bare)).toEqual({
      statusCode: 400,
      code: null,
      reason: "Invalid code",
    });
  });
});

describe("logOtpFailure", () => {
  test("logs a rejection with reason and returns true", () => {
    const warn = mock((_payload?: unknown, _message?: string) =>
      Promise.resolve()
    );
    const authLogger = { warn };

    const logged = logOtpFailure({
      authLogger: authLogger as never,
      path: "/sign-in/email-otp",
      returned: makeApiError(401, "Invalid OTP"),
    });

    expect(logged).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);

    const firstCall = warn.mock.calls[0] as unknown as [
      Record<string, unknown>,
      string,
    ];
    const [payload, message] = firstCall;
    expect(message).toBe("OTP request rejected.");
    expect(payload.event).toBe("otp_request_failed");
    expect(payload.statusCode).toBe(401);
    expect(payload.reason).toBe("Invalid OTP");
  });

  test("returns false for non-failures so the success path still logs", () => {
    const warn = mock((_payload?: unknown, _message?: string) =>
      Promise.resolve()
    );
    const authLogger = { warn };

    const logged = logOtpFailure({
      authLogger: authLogger as never,
      path: "/sign-in/email-otp",
      returned: { token: "session-token" },
    });

    expect(logged).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("OTP_PATHS", () => {
  test("covers send, verify, and sign-in", () => {
    expect(OTP_PATHS).toContain("/email-otp/send-verification-otp");
    expect(OTP_PATHS).toContain("/email-otp/verify-email");
    expect(OTP_PATHS).toContain("/sign-in/email-otp");
  });
});
