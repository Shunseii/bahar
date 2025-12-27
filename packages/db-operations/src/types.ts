/**
 * Shared types for database operations.
 */

/**
 * Table operation definition for tanstack-query integration.
 */
export interface TableOperation {
  // biome-ignore lint/suspicious/noExplicitAny: need any here
  query?: (...args: any[]) => Promise<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: need any here
  mutation?: (...args: any[]) => Promise<unknown>;
  /**
   * Cache options for tanstack-query.
   */
  cacheOptions: {
    queryKey: `turso.${string}`[];
    staleTime?: number;
  };
}
