/**
 * Foreground OTA update flow.
 *
 * expo-updates downloads a new update at cold launch but only *runs* it on the
 * next one, so a tester with the app already open gets no signal that a new
 * build exists. This drives the visible flow instead: check on mount and on
 * every foreground, download on tap, then reload once the update is staged.
 */

import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";
import { useUpdates } from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  deriveOtaUpdateStatus,
  type OtaUpdateStatus,
  shouldCheckForUpdate,
} from "@/lib/updates/state";

/**
 * False in dev clients and Expo Go, where expo-updates is disabled and every
 * check would throw. Constant for the lifetime of the process.
 */
const isOtaEnabled = Updates.isEnabled;

interface UseOtaUpdateResult {
  status: OtaUpdateStatus;
  /**
   * 0..1 while downloading. Undefined when the asset server sends no
   * Content-Length, in which case the UI falls back to an indeterminate bar.
   */
  downloadProgress: number | undefined;
  startDownload: () => void;
  restart: () => void;
  dismiss: () => void;
}

export const useOtaUpdate = (): UseOtaUpdateResult => {
  const {
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    isRestarting,
    downloadProgress,
    lastCheckForUpdateTimeSinceRestart,
    checkError,
    downloadError,
  } = useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const lastCheckedAtRef = useRef<number | undefined>(undefined);

  // Mirrored into a ref so the foreground listener below can read the latest
  // check time without resubscribing every time it changes. The native
  // ON_LOAD check reports through here too, which is what keeps our on-mount
  // check from duplicating it.
  useEffect(() => {
    if (lastCheckForUpdateTimeSinceRestart) {
      lastCheckedAtRef.current = lastCheckForUpdateTimeSinceRestart.getTime();
    }
  }, [lastCheckForUpdateTimeSinceRestart]);

  useEffect(() => {
    if (!isOtaEnabled) return;

    const check = () => {
      const now = Date.now();
      if (
        !shouldCheckForUpdate({ lastCheckedAt: lastCheckedAtRef.current, now })
      )
        return;

      // Stamped before the request so a foreground that lands mid-flight
      // doesn't start a second one.
      lastCheckedAtRef.current = now;
      Updates.checkForUpdateAsync().catch(() => {
        // Surfaces through the hook's checkError, reported below.
      });
    };

    check();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;

      // A "Later" tap only holds until the app is reopened.
      setDismissed(false);
      check();
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!checkError) return;

    Sentry.captureException(checkError, { fingerprint: ["ota-check-error"] });
  }, [checkError]);

  useEffect(() => {
    if (!downloadError) return;

    Sentry.captureException(downloadError, {
      fingerprint: ["ota-download-error"],
    });
  }, [downloadError]);

  const startDownload = useCallback(() => {
    Updates.fetchUpdateAsync().catch(() => {
      // Surfaces through the hook's downloadError, reported above.
    });
  }, []);

  const restart = useCallback(() => {
    Updates.reloadAsync().catch((error) => {
      Sentry.captureException(error, { fingerprint: ["ota-reload-error"] });
    });
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    status: isOtaEnabled
      ? deriveOtaUpdateStatus({
          isUpdateAvailable,
          isUpdatePending,
          isDownloading,
          isRestarting,
          dismissed,
        })
      : "idle",
    downloadProgress,
    startDownload,
    restart,
    dismiss,
  };
};
