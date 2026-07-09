import type { Cookie } from "@playwright/test";

export interface E2eConfig {
  /** Base URL of the running API, e.g. https://local.bahar.dev */
  apiBaseUrl: string;
  /** Base URL of the web app under test, e.g. http://localhost:5173 */
  webBaseUrl: string;
  /** Central DB URL holding the `verifications` table, e.g. http://localhost:8080 */
  centralDbUrl: string;
  /** Auth token for the central DB; undefined for the local turso dev server */
  centralDbToken: string | undefined;
  /** Email of the user to sign in (created on first run when sign-up is enabled) */
  email: string;
}

export interface StorageState {
  cookies: Cookie[];
  origins: never[];
}

/** Absolute path of the Playwright storageState file this module reads/writes. */
export const STORAGE_STATE_PATH: string;

/** Resolves harness config from env with local-dev defaults. */
export function resolveE2eConfig(): E2eConfig;

/** Runs the headless sign-in flow and returns a Playwright storageState object. */
export function mintSession(config?: E2eConfig): Promise<StorageState>;

/** Mints a session, writes it to `STORAGE_STATE_PATH`, and returns that path. */
export function writeStorageState(config?: E2eConfig): Promise<string>;
