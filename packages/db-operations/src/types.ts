/**
 * Shared types for database operations.
 */

/**
 * Converts all `null` union members to `undefined` in an object type.
 * @example
 * type User = { name: string | null; age: number | null }
 * type UserUndefined = NullToUndefined<User>
 * // { name: string | undefined; age: number | undefined }
 */
export type NullToUndefined<T> = {
  [K in keyof T]: null extends T[K] ? Exclude<T[K], null> | undefined : T[K];
};

/**
 * Table operation definition for tanstack-query integration.
 */
export interface TableOperation {
  // biome-ignore lint/suspicious/noExplicitAny: need any here
  query?: (...args: any[]) => Promise<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: need any here
  mutation?: (...args: any[]) => Promise<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: need any here
  generator?: (...args: any[]) => AsyncGenerator<unknown>;
  /**
   * Cache options for tanstack-query.
   */
  cacheOptions: {
    queryKey: `turso.${string}`[];
    staleTime?: number;
  };
}
