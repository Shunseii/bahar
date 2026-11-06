import { Trans } from "@lingui/react/macro";
import * as Network from "expo-network";
import { useAtomValue, useSetAtom } from "jotai";
import { Cloud, CloudOff } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { isOfflineAtom, isSyncingAtom, lastSyncedAtAtom } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

/**
 * How long after a successful sync the app stops claiming to be up to date.
 * Periodic sync runs every 60s, so passing this means several attempts in a
 * row have failed rather than one being slow.
 */
const STALE_AFTER_MS = 1000 * 60 * 5;

export const SyncIndicator = () => {
  const isSyncing = useAtomValue(isSyncingAtom);
  const isOffline = useAtomValue(isOfflineAtom);
  const lastSyncedAt = useAtomValue(lastSyncedAtAtom);
  const setIsOffline = useSetAtom(isOfflineAtom);
  const colors = useThemeColors();

  // The db layer keeps its own cached copy for DbPlatform.isOffline, which
  // is synchronous and cannot be read reactively; this subscribes for the
  // UI's benefit.
  useEffect(() => {
    const apply = (state: Network.NetworkState) =>
      setIsOffline(
        state.isConnected === false || state.isInternetReachable === false
      );

    Network.getNetworkStateAsync()
      .then(apply)
      .catch(() => {
        // Leave the optimistic default; an event will correct it.
      });

    const subscription = Network.addNetworkStateListener(apply);

    return () => subscription.remove();
  }, [setIsOffline]);

  const isStale =
    lastSyncedAt === null || Date.now() - lastSyncedAt > STALE_AFTER_MS;

  if (!(isSyncing || isOffline || isStale)) return null;

  return (
    <View className="absolute right-4 bottom-20 z-50" role="status">
      <View className="flex-row items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2 shadow-lg">
        {isSyncing ? (
          <Cloud color={colors.mutedForeground} size={16} />
        ) : (
          <>
            <CloudOff color={colors.mutedForeground} size={16} />
            {/* Both states mean the same thing to the user -- their changes
                are saved here but have not reached the server -- so the
                wording differs only in why. */}
            <Text className="text-muted-foreground text-sm">
              {isOffline ? <Trans>Offline</Trans> : <Trans>Not synced</Trans>}
            </Text>
          </>
        )}
      </View>
    </View>
  );
};
