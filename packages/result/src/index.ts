/**
 * @bahar/result - Rust-like Result type for explicit error handling
 *
 * Provides a type-safe way to handle errors without exceptions.
 * Used across web and mobile apps for consistent error handling.
 */

/**
 * Result type representing either success (Ok) or failure (Err)
 */
export type Result<T, E = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Creates a success Result
 */
export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

/**
 * Creates an error Result with preserved literal types
 */
export const err = <const E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

/**
 * Wraps an async function and returns a Result with mapped errors
 */
export const tryCatch = async <T, const E>(
  fn: () => Promise<T>,
  mapError: (error: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(mapError(error));
  }
};

/**
 * Type guard to check if a Result is Ok
 */
export const isOk = <T, E>(
  result: Result<T, E>
): result is { ok: true; value: T } => {
  return result.ok;
};

/**
 * Type guard to check if a Result is Err
 */
export const isErr = <T, E>(
  result: Result<T, E>
): result is { ok: false; error: E } => {
  return !result.ok;
};
