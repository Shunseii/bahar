import { ensureDb } from "..";
import { getDrizzleDb } from "../adapter";

/**
 * The DB accessor injected into the shared @bahar/db-operations factories:
 * ensures the local DB is initialized, then returns the drizzle instance
 * (built over sync-react-native via the sqlite-proxy adapter).
 */
export const getDb = async () => {
  await ensureDb();
  return getDrizzleDb();
};
