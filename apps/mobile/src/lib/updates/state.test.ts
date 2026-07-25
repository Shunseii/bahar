import {
  deriveOtaUpdateStatus,
  MIN_CHECK_INTERVAL_MS,
  shouldCheckForUpdate,
} from "./state";

const NOW = 1_700_000_000_000; // fixed epoch ms so cases are deterministic

/** All flags off -- spread over this and flip only what a case is about. */
const IDLE_FLAGS = {
  isUpdateAvailable: false,
  isUpdatePending: false,
  isDownloading: false,
  isRestarting: false,
  dismissed: false,
};

describe("deriveOtaUpdateStatus", () => {
  it("is idle when no update has been found", () => {
    expect(deriveOtaUpdateStatus(IDLE_FLAGS)).toBe("idle");
  });

  it("reports an available update that has not started downloading", () => {
    expect(
      deriveOtaUpdateStatus({ ...IDLE_FLAGS, isUpdateAvailable: true })
    ).toBe("available");
  });

  it("prefers downloading over available while a fetch is in flight", () => {
    // The flags are cumulative -- isUpdateAvailable stays true for the whole
    // download, so the more advanced state has to win.
    expect(
      deriveOtaUpdateStatus({
        ...IDLE_FLAGS,
        isUpdateAvailable: true,
        isDownloading: true,
      })
    ).toBe("downloading");
  });

  it("prefers ready over the earlier states once the update is staged", () => {
    expect(
      deriveOtaUpdateStatus({
        ...IDLE_FLAGS,
        isUpdateAvailable: true,
        isUpdatePending: true,
      })
    ).toBe("ready");
  });

  it("goes idle while a restart is underway", () => {
    // The native reload screen takes over here, so the modal must not linger
    // on top of it.
    expect(
      deriveOtaUpdateStatus({
        ...IDLE_FLAGS,
        isUpdateAvailable: true,
        isUpdatePending: true,
        isRestarting: true,
      })
    ).toBe("idle");
  });

  it("goes idle when the user has dismissed the prompt", () => {
    expect(
      deriveOtaUpdateStatus({
        ...IDLE_FLAGS,
        isUpdateAvailable: true,
        isUpdatePending: true,
        dismissed: true,
      })
    ).toBe("idle");
  });

  it("keeps a dismissal in force at every earlier stage too", () => {
    expect(
      deriveOtaUpdateStatus({
        ...IDLE_FLAGS,
        isUpdateAvailable: true,
        dismissed: true,
      })
    ).toBe("idle");

    expect(
      deriveOtaUpdateStatus({
        ...IDLE_FLAGS,
        isUpdateAvailable: true,
        isDownloading: true,
        dismissed: true,
      })
    ).toBe("idle");
  });
});

describe("shouldCheckForUpdate", () => {
  it("checks when nothing has checked yet this run", () => {
    expect(shouldCheckForUpdate({ lastCheckedAt: undefined, now: NOW })).toBe(
      true
    );
  });

  it("skips a check that lands inside the throttle window", () => {
    // The cold-launch case: the native ON_LOAD check just ran, so the JS
    // check on mount must not duplicate it.
    expect(
      shouldCheckForUpdate({
        lastCheckedAt: NOW - (MIN_CHECK_INTERVAL_MS - 1),
        now: NOW,
      })
    ).toBe(false);

    expect(shouldCheckForUpdate({ lastCheckedAt: NOW, now: NOW })).toBe(false);
  });

  it("checks once the throttle window has elapsed", () => {
    expect(
      shouldCheckForUpdate({
        lastCheckedAt: NOW - MIN_CHECK_INTERVAL_MS,
        now: NOW,
      })
    ).toBe(true);

    expect(
      shouldCheckForUpdate({
        lastCheckedAt: NOW - 5 * MIN_CHECK_INTERVAL_MS,
        now: NOW,
      })
    ).toBe(true);
  });
});
