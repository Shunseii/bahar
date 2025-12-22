/**
 * Database adapter interface for cross-platform database operations.
 *
 * Both web (Turso sync-wasm) and mobile (op-sqlite with libsql) implement this interface.
 */

/**
 * A prepared statement that can be executed with parameters.
 */
export interface PreparedStatement<T = unknown> {
  /**
   * Execute the statement and return all matching rows.
   */
  all(params?: unknown[]): Promise<T[]>;

  /**
   * Execute the statement and return the first matching row.
   */
  get(params?: unknown[]): Promise<T | undefined>;

  /**
   * Execute the statement (for INSERT/UPDATE/DELETE).
   */
  run(params?: unknown[]): Promise<void>;
}

/**
 * Database adapter interface that abstracts the database implementation.
 */
export interface DatabaseAdapter {
  /**
   * Prepare a SQL statement for execution.
   */
  prepare<T = unknown>(sql: string): PreparedStatement<T>;

  /**
   * Execute raw SQL (for migrations/schema changes).
   */
  exec(sql: string): Promise<void>;

  /**
   * Sync local changes to remote (push).
   */
  push?(): Promise<void>;

  /**
   * Sync remote changes to local (pull).
   */
  pull?(): Promise<void>;

  /**
   * Close the database connection.
   */
  close(): Promise<void>;
}

/**
 * Factory function type for creating database adapters.
 */
export type DatabaseAdapterFactory = (config: {
  path: string;
  url?: string;
  authToken?: string;
}) => Promise<DatabaseAdapter>;
