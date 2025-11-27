import { z } from "zod";

/**
 * Simple Result type for error handling
 */
export type Result<T, E = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Creates a success Result with inferred value type
 */
export const ok = <T>(value: T) => ({
  ok: true as const,
  value,
});

/**
 * Creates an error Result with inferred literal types preserved
 */
export const err = <const E>(error: E) => ({
  ok: false as const,
  error,
});

/**
 * Wraps a promise and returns a `Result` with error handling
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
 * Safely parses JSON using Zod schema validation
 * Returns a Result with null value on parse failure
 */
export const safeJsonParse = <T extends z.ZodTypeAny>(
  json: string | null | undefined,
  schema: T,
): Result<z.infer<T> | null> => {
  if (!json) return { ok: true, value: null };

  try {
    const parsed = JSON.parse(json);
    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      return err(validated.error.issues);
    }
    return ok(validated.data);
  } catch (error) {
    if (error instanceof Error) {
      return err([{ message: error.message }]);
    }

    return err([{ message: "Unknown error" }]);
  }
};
