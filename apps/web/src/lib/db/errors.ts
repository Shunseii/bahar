export class DatabaseNotInitializedError extends Error {
  constructor() {
    super("Database not initialized.");
  }
}

export class DatabaseConnectionError extends Error {
  constructor() {
    super("Unable to connect to local database.");
  }
}

/**
 * Displayable errors are errors that can be surfaced to the user
 * in the UI.
 */
export const isDisplayError = (err: Error) => {
  if (
    err instanceof DatabaseNotInitializedError ||
    err instanceof DatabaseConnectionError
  ) {
    return true;
  }

  return false;
};
