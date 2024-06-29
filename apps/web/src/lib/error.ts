import { t } from "@lingui/macro";
import { type ErrorObject } from "ajv";

/**
 * An error thrown when importing a dictionary.
 */
export class ImportError extends Error {
  private _errors: ErrorObject[];

  constructor({ message, errors }: { message: string; errors: ErrorObject[] }) {
    super(message);

    this._errors = errors;
    this.name = "ImportError";
  }

  get errors() {
    return this._errors;
  }
}

/**
 * Parses the errors returned by the AJV validator for importing a dictionary.
 *
 * @param errors - The errors returned by the AJV validator.
 * @returns An array of error messages.
 *
 */
export const parseImportErrors = (errors: ErrorObject[]): string[] => {
  let errorMessages: string[] = [];

  if (errors && errors.length > 0) {
    errorMessages = errors.map((error) => {
      const instancePath = error.instancePath;
      const message = formatErrorMessage(error);

      return `${instancePath ? instancePath + ": " : ""}${message}`;
    });
  }

  return errorMessages;
};

const formatErrorMessage = (error: ErrorObject) => {
  switch (error.keyword) {
    case "required":
      return t`Missing required property: ${error.params.missingProperty}`;
    case "type":
      return t`Invalid type. Expected ${error.params.type}`;

    default:
      return error.message;
  }
};
