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
  mapError: (error: unknown) => E,
): Promise<Result<T, E>> => {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(mapError(error));
  }
};

/**
 * Wraps a sync function and returns a Result with mapped errors
 */
export const tryCatchSync = <T, const E>(
  fn: () => T,
  mapError: (error: unknown) => E,
): Result<T, E> => {
  try {
    const value = fn();
    return ok(value);
  } catch (error) {
    return err(mapError(error));
  }
};

/**
 * Unwraps a Result, throwing if it's an error
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
};

/**
 * Unwraps a Result or returns a default value if it's an error
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
};

/**
 * Maps the value of a successful Result
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
};

/**
 * Maps the error of a failed Result
 */
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> => {
  if (!result.ok) {
    return err(fn(result.error));
  }
  return result;
};

/**
 * Chains Results together (flatMap)
 */
export const andThen = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
};

/**
 * Type guard to check if a Result is Ok
 */
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } => {
  return result.ok;
};

/**
 * Type guard to check if a Result is Err
 */
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => {
  return !result.ok;
};
