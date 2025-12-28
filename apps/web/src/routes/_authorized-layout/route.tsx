import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import * as Sentry from "@sentry/react";
import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  type ErrorRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { useMeasure } from "@uidotdev/usehooks";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { hydrationSkippedCountAtom } from "@/atoms/hydration";
import { isSyncingAtom, syncCompletedCountAtom } from "@/atoms/sync";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { DesktopNavigation } from "@/components/DesktopNavigation";
import { ErrorMessage } from "@/components/errors/ErrorMessage";
import { MobileHeader } from "@/components/MobileHeader";
import { SchemaOutdatedBanner } from "@/components/SchemaOutdatedBanner";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useSearch } from "@/hooks/useSearch";
import { authClient } from "@/lib/auth-client";
import { ensureDb, initDb } from "@/lib/db";
import { DisplayError } from "@/lib/db/errors";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { migrationTable } from "@/lib/db/operations/migration";
import { enqueueSyncOperation } from "@/lib/db/queue";
import { queryClient } from "@/lib/query";
import { hydrateOramaDb, rehydrateOramaDb } from "@/lib/search";
import { store } from "@/lib/store";

/**
 * How often to sync the user database in the background.
 */
const BACKGROUND_SYNC_INTERVAL = 15 * 1000;

const PendingComponent = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <AnimatedLogo className="h-20 w-20" />
    </div>
  );
};

const AuthorizedLayout = () => {
  const { preloadResults } = useSearch();
  const [hydrationSkippedCount, setHydrationSkippedCount] = useAtom(
    hydrationSkippedCountAtom
  );
  const { data: latestMigration } = useQuery({
    queryKey: migrationTable.latestMigration.cacheOptions.queryKey,
    queryFn: migrationTable.latestMigration.query,
  });
  const [bannerRef, { height: bannerHeight }] = useMeasure();

  const schemaIsOutdated = latestMigration?.status === "failed";

  useEffect(() => {
    preloadResults();
  }, [preloadResults]);

  // Show toast if some dictionary entries were skipped during hydration
  useEffect(() => {
    if (!hydrationSkippedCount) return;

    const id = requestAnimationFrame(() => {
      toast.warning(t`Some dictionary entries couldn't be loaded`, {
        description: plural(hydrationSkippedCount, {
          one: "# entry was skipped due to data issues. Your data is preserved, but you won't be able to search for the entry that wasn't loaded.",
          other:
            "# entries were skipped due to data issues. Your data is preserved, but you won't be able to search for any entries that weren't loaded.",
        }),
      });

      setHydrationSkippedCount(0);
    });

    return () => cancelAnimationFrame(id);
  }, [hydrationSkippedCount]);

  const dictionaryChangedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        store.set(isSyncingAtom, true);

        await enqueueSyncOperation(async () => {
          const maxTsBefore = await dictionaryEntriesTable.maxUpdatedAt.query();

          const db = await ensureDb();

          Sentry.logger.info("Background syncing...");

          await db.pull();
          await db.push();

          const maxTsAfter = await dictionaryEntriesTable.maxUpdatedAt.query();
          dictionaryChangedRef.current = maxTsBefore !== maxTsAfter;

          Sentry.logger.info("Background sync complete", {
            dictionaryChanged: dictionaryChangedRef.current,
          });
        });

        store.set(syncCompletedCountAtom, (c) => c + 1);
      } catch (error) {
        Sentry.logger.warn("Background sync failed", {
          reason: String(error),
        });
      } finally {
        store.set(isSyncingAtom, false);
      }
    }, BACKGROUND_SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Sync when app visibility changes (e.g., user switches apps on mobile PWA)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      try {
        if (document.hidden) {
          // App going to background - push local changes
          Sentry.logger.info("Visibility hidden, pushing...");
          await enqueueSyncOperation(async () => {
            const db = await ensureDb();
            await db.push();
          });
        } else {
          // App coming to foreground - pull remote changes
          Sentry.logger.info("Visibility visible, pulling...");
          store.set(isSyncingAtom, true);

          await enqueueSyncOperation(async () => {
            const db = await ensureDb();
            const maxTsBefore =
              await dictionaryEntriesTable.maxUpdatedAt.query();
            await db.pull();
            const maxTsAfter =
              await dictionaryEntriesTable.maxUpdatedAt.query();
            dictionaryChangedRef.current = maxTsBefore !== maxTsAfter;
          });

          store.set(syncCompletedCountAtom, (c) => c + 1);
        }
      } catch (error) {
        Sentry.logger.warn("Visibility sync failed", {
          reason: String(error),
        });
      } finally {
        store.set(isSyncingAtom, false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const syncCompletedCount = useAtomValue(syncCompletedCountAtom);
  const { refresh } = useSearch();

  useEffect(() => {
    if (syncCompletedCount === 0) return;

    const refreshAfterSync = async () => {
      if (dictionaryChangedRef.current) {
        await rehydrateOramaDb();
        refresh();
        Sentry.logger.info("Orama reindexed after sync");
      }

      queryClient.invalidateQueries();
    };

    refreshAfterSync();
  }, [syncCompletedCount, refresh]);

  return (
    <div style={schemaIsOutdated ? { marginTop: `${bannerHeight}px` } : {}}>
      {schemaIsOutdated && <SchemaOutdatedBanner ref={bannerRef} />}
      <Outlet />
      <SyncIndicator />
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
            <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-6">
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
    const { data: session } = await authClient.getSession();

    if (session?.user) {
      Sentry.setUser({ id: session.user.id, email: session.user.email });
    }

    const initDbResult = await initDb();

    if (!initDbResult.ok) {
      const error = initDbResult.error;
      const errReason = "reason" in error ? error.reason : null;

      Sentry.captureException(new Error(error.type), {
        fingerprint: ["db-init-error", error.type],
        contexts: {
          db_init: {
            type: error.type,
            reason: errReason,
          },
        },
      });

      switch (error.type) {
        case "latest_migration_is_failing":
          // We ignore this error because we don't want to block user
          // from using the app if migration fails to apply. This is
          // because the code should aim to be backwards compatible
          // and thus still handle older schema versions.
          //
          // Fixing this will require manual work by a developer,
          // so capturing it as an issue in Sentry above is sufficient.
          break;

        case "get_db_info_failed":
          throw new DisplayError({
            message: t`There's a temporary issue loading your account. Please try reloading the page.`,
            details: t`Failed to retrieve database information.`,
            cause: error.type,
            hasManualFix: true,
          });

        case "token_refresh_failed":
        case "api_schema_verification_failed":
        case "db_connection_failed_after_refresh":
          throw new DisplayError({
            message: t`We can't reach our servers right now. Check your connection and try again.`,
            details: t`Unable to connect to remote database.`,
            cause: error.type,
            hasManualFix: true,
          });

        case "db_not_initialized":
        case "check_migration_table_exists_query_failed":
        case "local_migrations_query_failed":
          throw new DisplayError({
            message: t`We're having trouble with your account setup. Please try again.`,
            details: t`Failed to retrieve data from local database.`,
            cause: error.type,
            hasManualFix: true,
          });

        case "migration_failed":
          throw new DisplayError({
            message: t`Your account needs maintenance. We've been notified. Please try again later.`,
            details: t`Failed to apply migration to local database.`,
            cause: error.type,
          });

        case "opfs_lock_error":
          throw new DisplayError({
            message: t`The app may be open in another tab. Try closing other tabs and refreshing this page.`,
            details: t`The local database is locked by another session.`,
            cause: error.type,
            hasManualFix: true,
          });

        // Don't throw on turso sync errors
        // since user can still use local db
        case "turso_remote_sync_failed":
        case "turso_remote_sync_and_pull_failed":
        case "turso_db_pull_failed":
          break;

        default:
          throw new DisplayError({
            message: t`There was an unexpected error. Please try again.`,
            details: t`Unknown error.`,
          });
      }
    }

    const hydrateOramaDbResult = await hydrateOramaDb();

    if (!hydrateOramaDbResult.ok) {
      const error = hydrateOramaDbResult.error;

      switch (error.type) {
        case "hydration_failed":
          throw new DisplayError({
            message: t`We're having trouble with your account setup. Please try again.`,
            details: t`There was an error when indexing your data in the search engine.`,
            cause: error.type,
            hasManualFix: true,
          });

        default:
          throw new DisplayError({
            message: t`There was an unexpected error. Please try again.`,
            details: t`Unknown error.`,
          });
      }
    }

    if (hydrateOramaDbResult.value.skippedCount > 0) {
      // If there was a partial hydration, it will set
      // the skippedCount in a jotai atom. We will then
      // display this to the user.
      store.set(
        hydrationSkippedCountAtom,
        hydrateOramaDbResult.value.skippedCount
      );
    }
  },
  errorComponent: (props) => <AuthorizedLayoutError {...props} />,
  component: AuthorizedLayout,
  pendingComponent: PendingComponent,
  pendingMs: 500,
  pendingMinMs: 600,
});
