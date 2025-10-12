import path, { dirname } from "path";
import { fileURLToPath } from "url";
import $RefParser from "@apidevtools/json-schema-ref-parser";
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

/**
 * Bundles the entire dictionary schema into a single JSON.
 */
export const getFullSchema = async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(__dirname, "../schema.json");
  const schema = await $RefParser.bundle(schemaPath);

  return schema;
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
