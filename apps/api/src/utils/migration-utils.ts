import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { tursoPlatformClient } from "../clients/turso";
import { db } from "../db";
import { databases } from "../db/schema/databases";
import { logger } from "./logger";

export const refreshAccessToken = async (
  dbName: string,
  dbId: string
): Promise<string> => {
  logger.info({ dbName, dbId }, "Access token expired, creating new token...");

  const newToken = await tursoPlatformClient.databases.createToken(dbName, {
    authorization: "full-access",
    expiration: "2w",
  });

  await db
    .update(databases)
    .set({ access_token: newToken.jwt })
    .where(eq(databases.db_id, dbId));

  logger.info({ dbName, dbId }, "Created and saved new access token");

  return newToken.jwt;
};

export const createUserDbClient = async (
  hostname: string,
  accessToken: string,
  dbName: string,
  dbId: string
) => {
  const client = createClient({
    url: `libsql://${hostname}`,
    authToken: accessToken,
  });

  try {
    await client.execute("SELECT 1");
    return { client, token: accessToken };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("status 401")) {
      logger.info(
        { dbName, dbId },
        "Token appears to be expired, refreshing..."
      );
      const newToken = await refreshAccessToken(dbName, dbId);
      const newClient = createClient({
        url: `libsql://${hostname}`,
        authToken: newToken,
      });
      return { client: newClient, token: newToken };
    }
    throw err;
  }
};
