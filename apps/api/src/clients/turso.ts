import { createClient } from "@tursodatabase/api";
import { config } from "../config";

export const tursoClient = createClient({
  org: config.TURSO_ORG_SLUG,
  token: config.TURSO_PLATFORM_API_KEY,
});

