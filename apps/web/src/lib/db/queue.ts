import * as Sentry from "@sentry/react";
import { asyncQueue } from "@tanstack/pacer";

type DbOperation<T> = () => Promise<T>;

/**
 * Queue for serializing all database operations to prevent
 * "database is busy" errors from concurrent access.
 *
 * All local DB writes and sync operations should go through this queue.
 */
const dbQueue = asyncQueue(
  async <T>(operation: DbOperation<T>): Promise<T> => {
    return operation();
  },
  {
    concurrency: 1,
    onError: (error) => {
      Sentry.logger.error("Database queue operation failed", {
        error: String(error),
      });
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
 * Track if a sync operation is already pending to merge multiple sync requests.
 */
let syncPending = false;
let syncPromise: Promise<void> | null = null;

/**
 * Enqueue a sync operation (pull/push) with merging.
 * If a sync is already pending, returns the existing promise instead of queueing another.
 * This prevents sync operations from stacking up.
 */
export const enqueueSyncOperation = (
  operation: () => Promise<void>
): Promise<void> => {
  if (syncPending && syncPromise) {
    Sentry.logger.info("Sync already pending, merging request");
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
 * Check if there are pending operations in the queue.
 */
export const hasPendingOperations = (): boolean => {
  return syncPending;
};
