import { asyncQueue } from "@tanstack/pacer";

type DbOperation<T> = () => Promise<T>;

/**
 * Logging hooks for the queue. Default to no-ops; apps wire their own logger
 * once at startup via {@link configureDbQueue} (e.g. Sentry on web,
 * @sentry/react-native on mobile). Kept injectable so this package stays free
 * of any platform-specific logging dependency.
 */
let onError: (error: unknown) => void = () => {
  // no-op until an app configures a real handler
};
let onInfo: (message: string) => void = () => {
  // no-op until an app configures a real handler
};

export const configureDbQueue = (opts: {
  onError?: (error: unknown) => void;
  onInfo?: (message: string) => void;
}): void => {
  if (opts.onError) onError = opts.onError;
  if (opts.onInfo) onInfo = opts.onInfo;
};

/**
 * Queue for serializing all database operations to prevent "database is busy"
 * errors from concurrent access. All local DB writes and sync operations
 * should go through this single queue so they never overlap.
 */
const dbQueue = asyncQueue(
  <T>(operation: DbOperation<T>): Promise<T> => {
    return operation();
  },
  {
    concurrency: 1,
    asyncRetryerOptions: {
      maxAttempts: 1,
    },
    onError: (error) => {
      onError(error);
    },
  }
);

/**
 * Enqueue a database operation to be executed serially.
 * Returns a promise that resolves when the operation completes.
 */
export const enqueueDbOperation = <T>(
  operation: DbOperation<T>
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const wrappedOperation = async () => {
      try {
        const result = await operation();
        resolve(result);
        return result;
      } catch (error) {
        reject(error);
        throw error;
      }
    };

    dbQueue(wrappedOperation);
  });
};

/**
 * Tracks whether a sync operation is already in flight, so concurrent sync
 * requests merge into the one pending run instead of stacking up behind each
 * other on the queue.
 */
let syncPending = false;
let syncPromise: Promise<void> | null = null;

/**
 * Enqueue a sync operation (pull/push) with merging. If a sync is already
 * pending, returns the existing promise instead of queueing another.
 */
export const enqueueSyncOperation = (
  operation: () => Promise<void>
): Promise<void> => {
  if (syncPending && syncPromise) {
    onInfo("Sync already pending, merging request");
    return syncPromise;
  }

  syncPending = true;
  syncPromise = enqueueDbOperation(async () => {
    try {
      await operation();
    } finally {
      syncPending = false;
      syncPromise = null;
    }
  });

  return syncPromise;
};

/**
 * Whether a sync operation is currently pending.
 */
export const hasPendingOperations = (): boolean => {
  return syncPending;
};
