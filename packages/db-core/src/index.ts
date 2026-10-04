/**
 * @bahar/db-core - Orchestration for the user database lifecycle
 *
 * Owns the init/sync/recovery policies shared by web and mobile:
 * db-init state machine, sync retry policy, and conflict-recovery
 * policy. Platform code (sync-wasm on web, sync-react-native on
 * mobile) is injected as the `DbPlatform` boundary, so fault
 * injection is just a fake boundary in tests.
 *
 * @bahar/db-operations stays pure SQL; nothing here touches drizzle.
 */

export {
  type ConflictRecoveryResult,
  recoverFromSyncConflict,
  type SyncConflictPolicy,
  shouldRecoverFromConflict,
} from "./conflict-recovery";
export type {
  DbConnectionInfo,
  DbError,
  DbInitOutcome,
  DbPlatform,
  RetryPolicy,
  SyncOutcome,
} from "./init";
export { DEFAULT_RETRY_POLICY, runDbInit, runSync } from "./init";
export {
  classifySyncFailure,
  isSyncConflictError,
  type SyncFailureClassification,
} from "./sync-failure";
