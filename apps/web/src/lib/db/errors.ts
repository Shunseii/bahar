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
