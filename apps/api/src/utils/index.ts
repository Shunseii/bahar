import { decodeJwt } from "jose";

/**
 * Tokens expiring within this many days will be refreshed,
 * even if not expired.
 */
const TOKEN_REFRESH_THRESHOLD_DAYS = 5;

/**
 * Constructs all the allowed subdomains for this api server
 * given the main authorized `domain`.
 */
export const getAllowedDomains = (domains: string[]) => {
  return domains.flatMap((domain) => {
    const isLocal = domain.includes("localhost");
    const protocol = isLocal ? "http" : "https";

    return [`${protocol}://${domain}`, `${protocol}://www.${domain}`];
  });
};

export const isJwtExpiringSoon = ({
  token,
  thresholdDays = TOKEN_REFRESH_THRESHOLD_DAYS,
}: {
  token: string;

  /**
   * If the token's expiration date is within this many days,
   * it is considered expired.
   */
  thresholdDays?: number;
}): boolean => {
  try {
    const payload = decodeJwt(token);

    if (!payload.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemainingToExpiration = payload.exp - currentTime;

    const thresholdSeconds = thresholdDays * 24 * 60 * 60;

    return timeRemainingToExpiration < thresholdSeconds;
  } catch {
    return true;
  }
};

/**
 * Generator that yields batches of items from an array.
 */
export function* batchIterator<T>(items: T[], batchSize: number) {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize);
  }
}
