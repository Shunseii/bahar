import { cn } from "@bahar/design-system";
import { Trans } from "@lingui/react/macro";
import { useAtomValue } from "jotai";
import { Cloud, CloudOff } from "lucide-react";
import { isOfflineAtom, isSyncingAtom, lastSyncedAtAtom } from "@/atoms/sync";

/**
 * How long after a successful sync the app stops claiming to be up to date.
 * Background sync runs every 15s, so passing this means several attempts in
 * a row have failed rather than one being slow.
 */
const STALE_AFTER_MS = 1000 * 60 * 5;

export const SyncIndicator = () => {
  const isSyncing = useAtomValue(isSyncingAtom);
  const isOffline = useAtomValue(isOfflineAtom);
  const lastSyncedAt = useAtomValue(lastSyncedAtAtom);

  const isStale =
    lastSyncedAt === null || Date.now() - lastSyncedAt > STALE_AFTER_MS;

  // Nothing to say while syncs are landing on schedule.
  if (!(isSyncing || isOffline || isStale)) return null;

  return (
    <div className="fixed bottom-4 z-50 ltr:right-4 rtl:left-4">
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-2",
          "border bg-background/80 shadow-lg backdrop-blur-sm",
          "text-muted-foreground text-sm"
        )}
        role="status"
      >
        {isSyncing ? (
          <>
            <Cloud className="h-4 w-4 animate-pulse" />
            <span className="sr-only">
              <Trans>Syncing</Trans>
            </span>
          </>
        ) : (
          <>
            <CloudOff className="h-4 w-4" />
            {/* Both states mean the same thing to the user -- their changes
                are saved here but have not reached the server -- so the
                wording differs only in why. */}
            <span>
              {isOffline ? (
                <Trans>Offline — changes saved on this device</Trans>
              ) : (
                <Trans>Not synced — changes saved on this device</Trans>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
