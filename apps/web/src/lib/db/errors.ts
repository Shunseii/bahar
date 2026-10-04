/**
 * An error with a user-friendly and translated message
 * that can be displayed directly to the user in the UI.
 */
export class DisplayError extends Error {
  /**
   * Original error code.
   */
  cause?: string;

  /**
   * UI-friendly and translated details
   * describing the error.
   */
  details: string;

  /**
   * Whether there is a manual fix the user
   * can attempt such as reloading the page.
   */
  hasManualFix: boolean;

  constructor({
    message,
    cause,
    details,
    hasManualFix = false,
  }: {
    message: string;
    cause?: string;
    details: string;
    hasManualFix?: boolean;
  }) {
    super(message);

    this.name = "DisplayError";
    this.cause = cause;
    this.details = details;
    this.hasManualFix = hasManualFix;
  }
}

/**
 * Thrown by `ensureDb` when initialization has already failed.
 *
 * The failure itself is captured once at the route boundary with the full
 * db_init context (type, reason, stack, wasmTrap, retryable). This is the
 * downstream symptom of that same failure, and reporting it as well filed a
 * second Sentry issue every time -- which is why db-init counts read roughly
 * double. `beforeSend` in router.ts drops it; `initDb` still logs every
 * failure, so nothing is lost when it does.
 */
export class DbInitFailedError extends Error {
  /** The underlying DbError["type"] that init failed with. */
  dbErrorType: string;

  constructor({ dbErrorType }: { dbErrorType: string }) {
    super(`Database initialization failed: ${dbErrorType}`);

    this.name = "DbInitFailedError";
    this.dbErrorType = dbErrorType;
  }
}
