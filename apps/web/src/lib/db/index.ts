import { connect, Database } from "@tursodatabase/sync-wasm/vite";
import { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import { trpcClient } from "../trpc";
import { tryCatch } from "../result";
import * as Sentry from "@sentry/react";

/**
 * Singleton database instance connected to
 * a local copy of the user's database that syncs
 * with the remote database in turso.
 *
 * Initially undefined, but we initialize it
 * in the pre load of the root router.
 */
let db: Database | null = null;

const LOCAL_DB_PATH_PREFIX = "bahar-local";

export const getDb = () => {
  if (!db) {
    throw new Error("Database not initialized.");
  }

  return db;
};

export const resetDb = async () => {
  if (!db) return;

  await db.close();
  db = null;
};

/**
 * Initializes connection to the user's database
 * by querying the server for the connection information
 * then either creating or connecting to a local copy
 * of the database.
 *
 * Also runs an initial sync with remote and any new migrations.
 */
export const initDb = async () => {
  if (db) return { ok: true, value: undefined } as const;

  const infoResult = await tryCatch(
    () => trpcClient.databases.userDatabase.query(),
    (error) => ({
      type: "get_db_info_failed" as const,
      reason: String(error),
    }),
  );
  if (!infoResult.ok) return infoResult;

  const { access_token, hostname, db_name } = infoResult.value;

  const connectionResult = await tryCatch(
    () =>
      _connectToLocalDb({
        hostname,
        authToken: access_token,
        dbName: db_name,
      }),
    (error) => ({
      type: "db_connection_failed" as const,
      reason: String(error),
    }),
  );

  if (!connectionResult.ok) {
    const refreshResult = await tryCatch(
      () => trpcClient.databases.refreshUserToken.mutate(),
      (error) => ({
        type: "token_refresh_failed" as const,
        reason: String(error),
      }),
    );
    if (!refreshResult.ok) return refreshResult;

    const connectionAfterRefreshResult = await tryCatch(
      () =>
        _connectToLocalDb({
          hostname,
          authToken: refreshResult.value.access_token,
          dbName: db_name,
        }),
      (error) => ({
        type: "db_connection_failed_after_refresh" as const,
        reason: String(error),
      }),
    );

    if (!connectionAfterRefreshResult.ok) return connectionAfterRefreshResult;

    db = connectionAfterRefreshResult.value;
  } else {
    db = connectionResult.value;
  }

  const migrationResult = await applyRequiredMigrations();
  if (!migrationResult.ok) return migrationResult;

  const syncResult = await tryCatch(
    async () => {
      await db!.pull();
      await db!.push();
    },
    (error) => ({
      type: "turso_remote_sync_failed" as const,
      reason: String(error),
    }),
  );

  return syncResult;
};

/**
 * Executes any required migrations on the user database.
 * If a migration fails, it doesn't apply the rest.
 *
 * Records which migrations were applied in the database.
 * If there are any errors when recording the applied migrations,
 * it logs it in Sentry then continues applying the rest.
 *
 * If the latest migration is failing, it does not run
 * the rest of the migrations, if any.
 *
 * Note: all migrations must be idempotent otherwise
 * this logic will cause issues.
 */
const applyRequiredMigrations = async () => {
  if (!db) return { ok: true, value: undefined } as const;

  const latestMigrationStatus = await tryCatch(
    async () => {
      return db!
        .prepare("SELECT * FROM migrations ORDER BY version DESC LIMIT 1;")
        .get() as Promise<SelectMigration>;
    },
    (error) => ({
      type: "latest_migration_status_query_failed" as const,
      reason: String(error),
    }),
  );
  if (!latestMigrationStatus.ok) return latestMigrationStatus;

  if (latestMigrationStatus.value.status === "failed") {
    return {
      ok: false,
      error: {
        type: "latest_migration_is_failing",
        reason:
          "The most recent migration for the client database had failed before. Must be fixed manually before proceeding with the remaining migrations.",
      },
    } as const;
  }

  const currentSchemaVersion = await getCurrentSchemaVersion();
  if (!currentSchemaVersion) return { ok: true, value: undefined } as const;

  const verifySchemaResult = await tryCatch(
    () =>
      trpcClient.migrations.verifySchema.query({
        version: currentSchemaVersion,
      }),
    (error) => ({
      type: "api_schema_verification_failed" as const,
      reason: String(error),
    }),
  );
  if (!verifySchemaResult.ok) return verifySchemaResult;

  const { status, requiredMigrations } = verifySchemaResult.value;

  if (status === "latest" || !requiredMigrations?.length)
    return { ok: true, value: undefined } as const;

  for (const migration of requiredMigrations) {
    const nowTimestampMs = Date.now();

    const execResult = await tryCatch(
      () => db!.exec(migration.sql_script),
      (error) => ({
        type: "migration_failed" as const,
        reason: String(error),
        migrationVersion: migration.version,
      }),
    );

    if (!execResult.ok) {
      await tryCatch(
        () =>
          db!
            .prepare(
              "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
            )
            .run([
              migration.version,
              migration.description,
              nowTimestampMs,
              "failed",
            ]),
        (error) => {
          Sentry.logger.error("Failed to log migration failure", {
            migrationVersion: migration.version,
            reason: String(error),
          });
          return null;
        },
      );

      return execResult;
    }

    await tryCatch(
      () =>
        db!
          .prepare(
            "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
          )
          .run([
            migration.version,
            migration.description,
            nowTimestampMs,
            "applied",
          ]),
      (error) => {
        Sentry.logger.error("Failed to log successful migration", {
          migrationVersion: migration.version,
          reason: String(error),
        });
        return null;
      },
    );
  }

  return { ok: true, value: undefined } as const;
};

/**
 * @returns The current version of the local user database schema.
 */
const getCurrentSchemaVersion = async () => {
  if (!db) return undefined;

  try {
    const result: Pick<SelectMigration, "version"> | undefined = await db
      .prepare(
        "SELECT version FROM migrations WHERE status = 'applied' ORDER BY version DESC LIMIT 1;",
      )
      .get();

    return result?.version ?? 0;
  } catch (err) {
    // Assuming that this is a fresh database

    return 0;
  }
};

const _formatDbUrl = (hostname: string) => `libsql://${hostname}`;

const _formatLocalDbName = (dbName: string) =>
  `${LOCAL_DB_PATH_PREFIX}-${dbName}.db`;

const _connectToLocalDb = async ({
  hostname,
  authToken,
  dbName,
}: {
  hostname: string;
  authToken: string;
  dbName: string;
}) => {
  try {
    return connect({
      path: _formatLocalDbName(dbName),
      url: _formatDbUrl(hostname),
      authToken,
    });
  } catch (err) {
    console.error("Error connecting to local database: ", err);

    throw new Error("Unable to connect to local database.");
  }
};
