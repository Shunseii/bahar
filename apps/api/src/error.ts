export enum ErrorCode {
  // Meilisearch Error Codes
  // https://www.meilisearch.com/docs/reference/errors/error_codes
  INDEX_ALREADY_EXISTS = "index_already_exists",

  // Custom Error Codes
  UNKNOWN_ERROR = "unknown_error",
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
