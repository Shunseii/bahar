import { t } from "@lingui/core/macro";
import type { z } from "zod/v4";
import type { FormSchema as DictionarySchema } from "@/lib/schemas/dictionary";

type ZodDictionaryError = z.ZodError<z.infer<typeof DictionarySchema>>;

/**
 * Error codes used when importing a dictionary.
 */
export enum ImportErrorCode {
  INVALID_JSON = "invalid_json",
  VALIDATION_ERROR = "validation_error",
}

export type ImportResponseError = {
  code: ImportErrorCode;
  error: z.ZodError<z.infer<typeof DictionarySchema>>;
};

/**
 * An error thrown when importing a dictionary.
 */
export class ImportError extends Error {
  private _error: ZodDictionaryError;
  private _code: ImportErrorCode;

  constructor({
    message,
    error,
    code,
  }: {
    message: string;
    error: ZodDictionaryError;
    code: ImportErrorCode;
  }) {
    super(message);
    this._error = error;
    this.name = "ImportError";
    this._code = code;
  }

  get error() {
    return this._error;
  }

  get code() {
    return this._code;
  }
}

/**
 * Parses the errors returned by Zod when importing a dictionary.
 *
 * @param errors - The errors returned by Zod.
 * @returns An array of error messages.
 *
 */
export const parseImportErrors = ({
  error,
  code,
}: {
  error: ZodDictionaryError;
  code: string;
}): string[] => {
  if (code === ImportErrorCode.INVALID_JSON) {
    return [t`That is not valid JSON.`];
  }

  return error.issues.map((err) => {
    // The first number in the path array will be the array index
    const pathParts = err.path;

    let arrayIndex: number | undefined;
    let fieldPath: string;

    // Check if the first path element is a number (array index)
    if (typeof pathParts[0] === "number") {
      arrayIndex = pathParts[0];
      // Remove the index from the path for field names
      fieldPath = pathParts.slice(1).join(".");
    } else {
      fieldPath = pathParts.join(".");
    }

    // Build the location prefix
    const locationPrefix =
      arrayIndex !== undefined ? t`Entry ${arrayIndex}` : "";

    // Combine location and field path
    const prefix = locationPrefix
      ? fieldPath
        ? `${locationPrefix}, ${fieldPath}: `
        : `${locationPrefix}: `
      : fieldPath
        ? `${fieldPath}: `
        : "";

    return formattedErrorMessage({ err, prefix });
  });
};

const formattedErrorMessage = ({
  err,
  prefix,
}: {
  err: z.core.$ZodIssue;
  prefix: string;
}) => {
  switch (err.code) {
    case "invalid_type": {
      // Handle required field errors
      if (err.input === undefined) {
        return `${prefix}${t`Required field`}`;
      }

      return `${prefix}${t`Invalid type. Expected ${err.expected}`}`;
    }
    case "invalid_value":
      return `${prefix}${t`Invalid value. Expected one of: ${err.values.join(
        ", "
      )}`}`;
    case "invalid_format":
      if (err.format === "datetime") {
        return `${prefix}${t`Invalid datetime format`}`;
      }
      return `${prefix}${t`Invalid string format`}`;
    case "too_small":
      return `${prefix}${t`Value must be ${String(err.minimum)} or greater`}`;
    case "too_big":
      return `${prefix}${t`Value must be ${String(err.maximum)} or less`}`;
    default:
      return `${prefix}${err.message}`;
  }
};
