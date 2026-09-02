import { beforeEach, describe, expect, it, jest } from "@jest/globals";

/**
 * BAHAR-MOBILE-2: the sync-conflict recovery path (recoverFromSyncConflict)
 * is itself network-dependent -- it wipes the local replica and restarts the
 * app, which re-inits via connect+pull. Offline, that turned a sync conflict
 * into data loss: the replica was deleted and the fresh pull couldn't run.
 *
 * The scenario: sync throws conflict -> recovery runs -> network unavailable
 * -> the system must degrade (keep the stale local state) instead of
 * wiping. The decision policy itself (shouldRecoverFromConflict) is covered
 * in @bahar/db-core; this pins the mobile wiring: the guard inside
 * recoverFromSyncConflict.
 */

const mockReloadApp = jest.fn();
const mockSentryWarn = jest.fn();

jest.mock("expo", () => ({
  reloadAppAsync: (...args: unknown[]) => mockReloadApp(...args),
}));

jest.mock("@sentry/react-native", () => ({
  logger: {
    warn: (...args: unknown[]) => mockSentryWarn(...args),
    info: jest.fn(),
    error: jest.fn(),
  },
  captureException: jest.fn(),
}));

jest.mock("@tursodatabase/sync-react-native", () => ({
  getDbPath: (name: string) => `/data/${name}`,
  connect: jest.fn(),
}));

jest.mock("../../utils/api", () => ({
  api: {
    databases: { user: { get: jest.fn() } },
    migrations: { full: { get: jest.fn() } },
  },
}));

jest.mock("./adapter", () => ({
  connect: jest.fn(),
  isSyncError: (e: unknown) => String(e).includes("sync error"),
  syncDatabase: jest.fn(),
}));

const mockNavigator = { onLine: true };

beforeEach(() => {
  mockReloadApp.mockClear();
  mockSentryWarn.mockClear();
  mockNavigator.onLine = true;

  Object.defineProperty(globalThis, "navigator", {
    value: mockNavigator,
    configurable: true,
    writable: true,
  });
});

import { recoverFromSyncConflict } from ".";

describe("recoverFromSyncConflict offline guard (BAHAR-MOBILE-2)", () => {
  it("wipes and reloads when online", async () => {
    await recoverFromSyncConflict();

    expect(mockReloadApp).toHaveBeenCalled();
  });

  it("keeps the local replica when offline — no wipe, no reload", async () => {
    mockNavigator.onLine = false;

    await recoverFromSyncConflict();

    expect(mockReloadApp).not.toHaveBeenCalled();
    expect(mockSentryWarn).toHaveBeenCalledWith(
      "recoverFromSyncConflict: offline — deferring wipe, keeping local replica",
      { dbName: null }
    );
  });
});
