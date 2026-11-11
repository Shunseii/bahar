import { useLingui } from "@lingui/react/macro";
import { useAtomValue } from "jotai";
import { Cloud, CloudOff } from "lucide-react-native";
import { View } from "react-native";
import {
  isOfflineAtom,
  isSyncingAtom,
  lastSyncedAtAtom,
  lastSyncFailedAtom,
} from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

/**
 * How long after a successful sync the app stops claiming to be up to date.
 * Periodic sync runs every 60s, so passing this means several attempts in a
 * row have failed rather than one being slow.
 */
const STALE_AFTER_MS = 1000 * 60 * 5;

/**
 * "Not synced" needs both an old last sync and a failed attempt since. Age
 * alone flashed the icon on every open: after a few minutes in the
 * background the last sync is old before the foreground sync has had a
 * chance to run, and a cold start whose first sync failed while the network
 * woke up has no last sync at all.
 */
const isSyncOverdue = ({
  lastSyncedAt,
  lastSyncFailed,
}: {
  lastSyncedAt: number | null;
  lastSyncFailed: boolean;
}): boolean =>
  lastSyncFailed &&
  (lastSyncedAt === null || Date.now() - lastSyncedAt > STALE_AFTER_MS);

/**
 * Header icon for sync state. Icon-only so it never covers screen content,
 * which the earlier floating badge did (it sat over the add-word Save
 * button).
 */
export const SyncIndicator = () => {
  const { t } = useLingui();
  const isSyncing = useAtomValue(isSyncingAtom);
  const isOffline = useAtomValue(isOfflineAtom);
  const lastSyncedAt = useAtomValue(lastSyncedAtAtom);
  const lastSyncFailed = useAtomValue(lastSyncFailedAtom);
  const colors = useThemeColors();

  const isStale = isSyncOverdue({ lastSyncedAt, lastSyncFailed });

  if (!(isSyncing || isOffline || isStale)) return null;

  // Both non-syncing states mean the same thing to the user -- their changes
  // are saved here but have not reached the server -- so the label differs
  // only in why.
  const label = isSyncing
    ? t`Syncing`
    : isOffline
      ? t`Offline — changes saved on this device`
      : t`Not synced — changes saved on this device`;

  return (
    <View accessibilityLabel={label} className="ml-2 p-1" role="status">
      {isSyncing ? (
        <Cloud color={colors.mutedForeground} size={20} />
      ) : (
        <CloudOff color={colors.mutedForeground} size={20} />
      )}
    </View>
  );
};
