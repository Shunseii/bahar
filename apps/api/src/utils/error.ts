import { ZodError, z } from "zod";
import { DictionarySchema } from "../schemas";

export enum ErrorCode {
  // Meilisearch Error Codes
  // https://www.meilisearch.com/docs/reference/errors/error_codes
  INDEX_ALREADY_EXISTS = "index_already_exists",

  // Custom Error Codes
  UNKNOWN_ERROR = "unknown_error",
}

/**
 * Error codes used when importing a dictionary.
 */
export enum ImportErrorCode {
  INVALID_JSON = "invalid_json",
  VALIDATION_ERROR = "validation_error",
}

export class MeilisearchError extends Error {
  code: string;
  type: string;

  constructor({
    message,
    code,
    type,
  }: {
    message?: string;
    code: string;
    type: string;
  }) {
    super(message);

    this.code = code;
    this.type = type;
  }
}

export type ImportResponseError = {
  code: ImportErrorCode;
  error: ZodError<z.infer<typeof DictionarySchema>>;
};
