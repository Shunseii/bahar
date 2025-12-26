import { decodeJwt } from "jose";

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

export const isJwtExpired = (token: string): boolean => {
  try {
    const payload = decodeJwt(token);
    const currentTime = Math.floor(Date.now() / 1000);

    return payload.exp != null && payload.exp < currentTime;
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
