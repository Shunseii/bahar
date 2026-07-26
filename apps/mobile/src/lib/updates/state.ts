/**
 * Pure state logic for the foreground OTA update prompt, split out from the
 * expo-updates side effects in @/hooks/useOtaUpdate so it can be unit-tested in
 * isolation (no native modules or React).
 */

/**
 * Foreground checks are throttled to this interval. The native runtime already
 * checks at cold launch (`checkAutomatically` is at its `ON_LOAD` default), so
 * without a throttle an app that is backgrounded and reopened seconds later
 * would hit the update server again for nothing.
 */
export const MIN_CHECK_INTERVAL_MS = 60 * 1000;

export type OtaUpdateStatus = "idle" | "available" | "downloading" | "ready";

interface DeriveOtaUpdateStatusParams {
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  isDownloading: boolean;
  isRestarting: boolean;
  dismissed: boolean;
}

/**
 * Collapses the expo-updates state machine flags into the single status the UI
 * renders. Tested most-advanced-first because the flags are cumulative: an
 * update that finished downloading still reports `isUpdateAvailable`, and one
 * mid-download reports both that and `isDownloading`.
 */
export const deriveOtaUpdateStatus = ({
  isUpdateAvailable,
  isUpdatePending,
  isDownloading,
  isRestarting,
  dismissed,
}: DeriveOtaUpdateStatusParams): OtaUpdateStatus => {
  // The native reload screen owns the display once a restart is underway.
  if (isRestarting) return "idle";
  if (dismissed) return "idle";
  if (isUpdatePending) return "ready";
  if (isDownloading) return "downloading";
  if (isUpdateAvailable) return "available";

  return "idle";
};

interface ShouldCheckForUpdateParams {
  /** Epoch ms of the last check, native or JS. Undefined if none has run. */
  lastCheckedAt: number | undefined;
  now: number;
}

export const shouldCheckForUpdate = ({
  lastCheckedAt,
  now,
}: ShouldCheckForUpdateParams): boolean =>
  lastCheckedAt === undefined || now - lastCheckedAt >= MIN_CHECK_INTERVAL_MS;
