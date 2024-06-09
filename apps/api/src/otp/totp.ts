import { TimeSpan } from "lucia";
import { HMAC } from "oslo/crypto";
import { generateHOTP } from "oslo/otp";

// Note: we can't use oslo js here as the TOTPController they provide
// checks for the exact time counter instead of checking a window to
// account for delays.

export const OTP_VALID_PERIOD = new TimeSpan(30, "s");
export const OTP_DIGITS = 6;

/**
 * Generates a TOTP.
 *
 * WIll generate a secret using HMAC SHA-1.
 *
 * @returns The secret used to generate the TOTP and the OTP itself.
 */
export const generateOTP = async (
  {
    period = OTP_VALID_PERIOD,
    digits = OTP_DIGITS,
  }: {
    period?: TimeSpan;
    digits?: number;
  } = {
    period: OTP_VALID_PERIOD,
    digits: OTP_DIGITS,
  },
) => {
  const counter = Math.floor(Date.now() / period.milliseconds());
  const secret = await new HMAC("SHA-1").generateKey();

  const otp = await generateHOTP(secret, counter, digits);

  return { secret, otp };
};

/**
 * Validates the given OTP. Will check an additional time step
 * backward to account for things like network delay.
 */
export const verifyOTP = async ({
  period = OTP_VALID_PERIOD,
  secret,
  otp,
  digits = OTP_DIGITS,
}: {
  period?: TimeSpan;
  secret: ArrayBuffer;
  otp: string;
  digits?: number;
}) => {
  const counter = Math.floor(Date.now() / period.milliseconds());
  const newOTP = await generateHOTP(secret, counter, digits);

  if (newOTP === otp) {
    return true;
  }

  // If they are not the same, we check
  // an additional time step backward
  // to account for network delay.
  const nextTimeStepOTP = await generateHOTP(secret, counter - 1);

  if (nextTimeStepOTP === otp) {
    return true;
  }

  return false;
};
