import { importPKCS8, SignJWT } from "jose";
import { config } from "../utils/config";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const CLIENT_SECRET_EXPIRY_SECS = 60 * 60 * 24 * 150;

export const buildAppleClientSecret = async () => {
  const privateKey = await importPKCS8(config.APPLE_PRIVATE_KEY, "ES256");

  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.APPLE_KEY_ID })
    .setIssuer(config.APPLE_TEAM_ID)
    .setIssuedAt()
    .setExpirationTime(
      Math.floor(Date.now() / 1000) + CLIENT_SECRET_EXPIRY_SECS
    )
    .setAudience(APPLE_AUDIENCE)
    .setSubject(config.APPLE_CLIENT_ID)
    .sign(privateKey);
};
