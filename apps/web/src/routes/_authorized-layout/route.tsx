import { DesktopNavigation } from "@/components/DesktopNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { useSearch } from "@/hooks/useSearch";
import { getDb, initDb } from "@/lib/db";
import { migrationTable } from "@/lib/db/operations/migration";
import { hydrateOramaDb } from "@/lib/search";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  createFileRoute,
  ErrorRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DisplayError } from "@/lib/db/errors";
import * as Sentry from "@sentry/react";
import { ErrorMessage } from "@/components/errors/ErrorMessage";
import React from "react";
import { useMeasure } from "@uidotdev/usehooks";
import { SchemaOutdatedBanner } from "@/components/SchemaOutdatedBanner";

/**
 * How often to sync the user database in the background.
 */
const BACKGROUND_SYNC_INTERVAL = 60 * 1000;

const AuthorizedLayout = () => {
  const { preloadResults } = useSearch();
  const { data: latestMigration } = useQuery({
    queryKey: migrationTable.latestMigration.cacheOptions.queryKey,
    queryFn: migrationTable.latestMigration.query,
  });
  const [bannerRef, { height: bannerHeight }] = useMeasure();

  const schemaIsOutdated = latestMigration?.status === "failed";

  useEffect(() => {
    preloadResults();
  }, [preloadResults]);

  // Background sync
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const db = getDb();

        Sentry.logger.info("Background syncing...");

        await db.pull();
        await db.push();

        Sentry.logger.info("Background sync complete");
      } catch (error) {
        Sentry.logger.warn("Background sync failed", {
          reason: String(error),
        });
      }
    }, BACKGROUND_SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={schemaIsOutdated ? { marginTop: `${bannerHeight}px` } : {}}>
      {schemaIsOutdated && <SchemaOutdatedBanner ref={bannerRef} />}
      <Outlet />
    </div>
  );
};

const AuthorizedLayoutError: ErrorRouteComponent = ({ error }) => {
  return (
    <>
      <DesktopNavigation />

      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <div className="flex flex-col sm:gap-4 sm:py-4 ltr:sm:pl-14 rtl:sm:pr-14">
          <MobileHeader />

          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 flex flex-col items-center justify-center">
              <div className="max-w-md">
                <h2 className="font-semibold text-destructive">
                  <Trans>Uh oh! Something went wrong :/</Trans>
                </h2>

                <ErrorMessage error={error} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export const Route = createFileRoute("/_authorized-layout")({
  beforeLoad: async () => {
    const initDbResult = await initDb();

    if (!initDbResult.ok) {
      const error = initDbResult.error;

      Sentry.captureException(new Error(initDbResult.error.type), {
        contexts: {
          db_init: {
            type: initDbResult.error.type,
            reason: initDbResult.error.reason,
          },
        },
      });

      switch (error.type) {
        case "get_db_info_failed":
          throw new DisplayError({
            message: t`There's a temporary issue loading your account. Please try reloading the page.`,
            details: t`Failed to retrieve database information.`,
            cause: error.type,
            hasManualFix: true,
          });

        case "token_refresh_failed":
        case "turso_remote_sync_failed":
        case "db_connection_failed_after_refresh":
          throw new DisplayError({
            message: t`We can't reach our servers right now. Check your connection and try again.`,
            details: t`Unable to connect to remote database.`,
            cause: error.type,
            hasManualFix: true,
          });

        case "api_schema_verification_failed":
          throw new DisplayError({
            message: t`We're having trouble with your account setup. Please try again.`,
            details: t`Failed validating local database schema with server.`,
            cause: error.type,
            hasManualFix: true,
          });

        case "migration_failed":
          throw new DisplayError({
            message: t`Your account needs maintenance. We've been notified. Please try again later.`,
            details: t`Failed to apply migration to local database.`,
            cause: error.type,
          });

        case "latest_migration_status_query_failed":
          throw new DisplayError({
            message: t`We're having trouble accessing your account. Please try again.`,
            details: t`Unable to query status of client database.`,
            cause: error.type,
          });

        case "latest_migration_is_failing":
          // We ignore this error because we don't want to block user
          // from using the app if migration fails to apply. This is
          // because the code should aim to be backwards compatible
          // and thus still handle older schema versions.
          //
          // Fixing this will require manual work by a developer,
          // so capturing it as an issue in Sentry above is sufficient.
          break;
      }
    }

    await hydrateOramaDb();
  },
  errorComponent: (props) => <AuthorizedLayoutError {...props} />,
  component: AuthorizedLayout,
});
