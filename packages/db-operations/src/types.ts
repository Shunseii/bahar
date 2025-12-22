/**
 * Shared types for database operations.
 */

/**
 * Table operation definition for tanstack-query integration.
 */
export type TableOperation = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: (...args: any[]) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation?: (...args: any[]) => Promise<unknown>;
  /**
   * Cache options for tanstack-query.
   */
  cacheOptions: {
    queryKey: `turso.${string}`[];
    staleTime?: number;
  };
};
