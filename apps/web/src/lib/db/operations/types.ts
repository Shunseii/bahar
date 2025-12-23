export type TableOperation = {
  // Note: can't use a generic here to type the output
  // it will still be any when used with satisfies

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: (...args: any[]) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation?: (...args: any[]) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator?: (...args: any[]) => AsyncGenerator<unknown>;
  /**
   * The cache options for the query in tanstack query.
   */
  cacheOptions: {
    // Prefix with turso to ensure there's no conflict
    // with trpc query keys.
    queryKey: `turso.${string}`[];
    staleTime?: number;
  };
};
