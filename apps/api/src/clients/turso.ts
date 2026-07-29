import { createClient as createDbClient } from "@libsql/client";
import { createClient as createPlatformClient } from "@tursodatabase/api";
import { asc, eq, gt } from "drizzle-orm";
import { decodeJwt } from "jose";
import { customAlphabet } from "nanoid";
import { db as centralDb } from "../db";
import { databases } from "../db/schema/databases";
import { migrations } from "../db/schema/migrations";
import { config } from "../utils/config";
import { LogCategory, logger } from "../utils/logger";

// Explicitly typed with this return type to fix
// a type error on build when enabling declaration: true
// in tsconfig.json.
export const tursoPlatformClient: ReturnType<typeof createPlatformClient> =
  createPlatformClient({
    org: config.TURSO_ORG_SLUG,
    token: config.TURSO_PLATFORM_API_KEY,
  }) as ReturnType<typeof createPlatformClient>;

type TokenAuthorization = "full-access" | "read-only";

/**
 * Value of the `a` claim Turso puts on a database token for each authorization
 * level. This claim is what the database enforces writes against.
 */
const TOKEN_AUTHORIZATION_CLAIM = {
  "full-access": "rw",
  "read-only": "ro",
} as const;

/**
 * Mints a database token with a direct platform API call rather than through
 * `@tursodatabase/api`.
 *
 * The SDK always sends a `permissions.read_attach` body, even when the caller
 * asks for no permissions (its `createToken` defaults the database list to
 * `[]`). A token minted with that body comes back carrying a `p` (permissions)
 * claim and no `a` claim at all -- so `authorization=read-only` is silently
 * dropped and the token can write. Sending no body, as the platform API docs
 * do, yields `a: "ro"` and a token the database rejects writes on with
 * "SQL write operations are forbidden".
 */
const mintDatabaseToken = async ({
  dbName,
  authorization,
  expiration,
}: {
  dbName: string;
  authorization: TokenAuthorization;
  expiration: string;
}): Promise<{ jwt: string }> => {
  const url = new URL(
    `/v1/organizations/${config.TURSO_ORG_SLUG}/databases/${dbName}/auth/tokens`,
    "https://api.turso.tech"
  );

  url.searchParams.set("expiration", expiration);
  url.searchParams.set("authorization", authorization);

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.TURSO_PLATFORM_API_KEY}` },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to mint ${authorization} token for ${dbName}: ${response.status} ${await response.text()}`
    );
  }

  const { jwt } = (await response.json()) as { jwt?: string };

  if (!jwt) {
    throw new Error(
      `Turso returned no jwt for the ${authorization} token for ${dbName}`
    );
  }

  const expectedClaim = TOKEN_AUTHORIZATION_CLAIM[authorization];
  const { a: actualClaim } = decodeJwt(jwt);

  // A token whose `a` claim doesn't match what we asked for isn't restricted
  // the way callers are told it is, so refuse to hand it out at all.
  if (actualClaim !== expectedClaim) {
    throw new Error(
      `Expected a "${expectedClaim}" token for ${dbName}, but Turso returned a token with a: ${JSON.stringify(actualClaim)}`
    );
  }

  return { jwt };
};

/**
 * Creates a new access token for a user database. Defaults to full access with
 * a 2 week expiration -- what the apps hold, since they sync writes from a
 * local replica.
 *
 * Pass `authorization: "read-only"` for a caller that must not write directly,
 * i.e. the CLI and the agents driving it: their writes go through the API's
 * dictionary endpoints, which validate the payload and apply it with the same
 * operations the apps use. Read-only tokens are minted per request rather than
 * stored, so they're kept shorter-lived -- but still comfortably longer than
 * the CLI's 24h cache refresh buffer, or every command would re-fetch one.
 *
 * Read-only tokens bypass `@tursodatabase/api`, which cannot mint one -- see
 * {@link mintDatabaseToken}.
 */
export const createUserAccessToken = async ({
  dbName,
  authorization = "full-access",
  expiration = "2w",
}: {
  dbName: string;
  authorization?: TokenAuthorization;
  expiration?: string;
}): Promise<{ jwt: string }> => {
  if (authorization === "read-only") {
    return mintDatabaseToken({ dbName, authorization, expiration });
  }

  const accessToken = await tursoPlatformClient.databases.createToken(dbName, {
    authorization,
    expiration,
  });

  return accessToken;
};

/** See {@link createUserAccessToken}. */
export const READ_ONLY_TOKEN_EXPIRATION = "7d";

/**
 * Creates a new database for a user in Turso.
 * The format of the database name is `user-{userId}`.
 *
 * @returns The name of the new database and token.
 */
export const createNewUserDb = async () => {
  /**
   * The alphabet containing only the characters that can be used
   * to name a database in Turso.
   *
   * It can only include lowercase letters, numbers, and dashes.
   * Names cannot start or end with a dash so we don't include it
   * to be safe.
   */
  const customTursoDbNameAlphabet = "abcdefghijklmnopqrstuvwxyz1234567890";

  const randomId = customAlphabet(customTursoDbNameAlphabet, 21)();
  const dbName = `user-${randomId}`;

  logger.info(
    { dbName, category: LogCategory.DATABASE, event: "user_db_create.start" },
    "Creating user database in Turso..."
  );

  const newDb = await tursoPlatformClient.databases.create(dbName, {
    group: config.TURSO_DB_GROUP,
  });

  logger.info(
    { dbName, category: LogCategory.DATABASE, event: "user_db_create.end" },
    "Created user database in Turso."
  );

  logger.info(
    {
      dbName,
      category: LogCategory.DATABASE,
      event: "user_db_token_create.start",
    },
    "Creating user database token in Turso..."
  );

  const accessToken = await createUserAccessToken({ dbName: newDb.name });

  logger.info(
    {
      dbName,
      category: LogCategory.DATABASE,
      event: "user_db_token_create.end",
    },
    "Created user database token in Turso."
  );

  return { newDb, accessToken };
};

/**
 * Applies all migrations in the registry to a given database
 * that haven't already been applied.
 *
 * This is typically done for a new user database on creation
 * to bring the database up to date with the latest migrations.
 */
export const applyAllNewMigrations = async ({
  dbName,
  token,
  dbUrl,
}: {
  dbUrl: string;
  token: string;
  dbName: string;
}) => {
  const userDbClient = createDbClient({ url: dbUrl, authToken: token });

  const lastAppliedVersion = await (async () => {
    try {
      const { rows } = await userDbClient.execute(
        "SELECT version FROM migrations WHERE status = 'applied' ORDER BY version DESC LIMIT 1"
      );

      // Versioning starts at 1 in the schema registry
      // so 0 means we apply all migrations.
      return (rows[0]?.version ?? 0) as number;
    } catch (_err) {
      // If migrations table doesn't exist,
      // it means this is a fresh database
      // and it will throw an error with
      // the query above.
      return 0;
    }
  })();

  const pendingMigrations = await centralDb
    .select()
    .from(migrations)
    .where(gt(migrations.version, lastAppliedVersion))
    .orderBy(asc(migrations.version));

  logger.info(
    {
      dbName,
      lastAppliedVersion,
      category: LogCategory.DATABASE,
      event: "user_db_migrations_apply.start",
    },
    "Applying migrations to user database..."
  );

  for (const migration of pendingMigrations) {
    const nowTimestampMs = Date.now();

    // A migration can contain multiple SQL statements
    const sqlStatements = migration.sql_script
      .split(";")
      .map((stmt) => stmt.trim())
      .filter(Boolean);

    try {
      await userDbClient.batch(
        [
          ...sqlStatements,
          {
            sql: "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
            args: [
              migration.version,
              migration.description,
              nowTimestampMs,
              "applied",
            ],
          },
        ],
        "write"
      );
    } catch (err) {
      logger.error(
        {
          event: "unexpected_error",
          category: LogCategory.APPLICATION,
          err,
          migration,
          dbUrl,
        },
        "Error applying migration to user database. Skipping remaining migrations."
      );

      await userDbClient.execute({
        sql: "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
        args: [
          migration.version,
          migration.description,
          nowTimestampMs,
          "failed",
        ],
      });

      break;
    }
  }

  logger.info(
    {
      dbName,
      lastAppliedVersion,
      category: LogCategory.DATABASE,
      event: "user_db_migrations_apply.end",
    },
    "Applied migrations to user database."
  );
};

/**
 * Refreshes an expired access token for a user database.
 */
const refreshAccessToken = async (
  dbName: string,
  dbId: string
): Promise<string> => {
  logger.info(
    { dbName, dbId, category: LogCategory.DATABASE },
    "Refreshing access token..."
  );

  const newToken = await tursoPlatformClient.databases.createToken(dbName, {
    authorization: "full-access",
    expiration: "2w",
  });

  await centralDb
    .update(databases)
    .set({ access_token: newToken.jwt })
    .where(eq(databases.db_id, dbId));

  logger.info(
    { dbName, dbId, category: LogCategory.DATABASE },
    "Created and saved new access token"
  );

  return newToken.jwt;
};

/**
 * Gets a database client for a user's database, handling token refresh if needed.
 *
 * @param userId - The user ID to get the database client for
 * @returns The database client or null if the user doesn't have a database yet
 */
export const getUserDbClient = async (userId: string) => {
  const userDb = await centralDb
    .select()
    .from(databases)
    .where(eq(databases.user_id, userId))
    .limit(1);

  if (userDb.length === 0) {
    return null;
  }

  const { hostname, access_token, db_name, db_id } = userDb[0];

  const client = createDbClient({
    url: `libsql://${hostname}`,
    authToken: access_token,
  });

  // Test the connection
  try {
    await client.execute("SELECT 1");
    return client;
  } catch (err) {
    // Check if it's an auth error (expired token)
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("status 401")) {
      logger.info(
        { dbName: db_name, dbId: db_id, category: LogCategory.DATABASE },
        "Token appears to be expired, refreshing..."
      );

      const newToken = await refreshAccessToken(db_name, db_id);
      const newClient = createDbClient({
        url: `libsql://${hostname}`,
        authToken: newToken,
      });
      return newClient;
    }

    throw err;
  }
};
