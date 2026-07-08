/**
 * Error carrying the HTTP status alongside a human-readable message, thrown by
 * {@link readJsonResponse} when a backend response is unusable.
 */
export class HttpResponseError extends Error {
  readonly status: number;

  constructor({ message, status }: { message: string; status: number }) {
    super(message);
    this.name = "HttpResponseError";
    this.status = status;
  }
}

const SNIPPET_LENGTH = 300;

const bodySnippet = (body: string): string =>
  body.trim().replace(/\s+/g, " ").slice(0, SNIPPET_LENGTH);

/**
 * Status-based hint only. We deliberately do NOT sniff the body text for
 * phrases like "rate limit" — an unrelated response (e.g. a 401 whose body
 * happens to mention "try again") was being mislabeled as rate limiting,
 * hiding the real error. Trust the status code, and always surface the raw
 * body so the exact server message is visible.
 */
const statusHint = (status: number): string => {
  if (status === 401 || status === 403) {
    return " You're not authenticated or your session expired — run `bahar login` and try again.";
  }
  if (status === 429 || status === 503) {
    return " The server is rate limiting or temporarily unavailable — wait a moment and try again.";
  }
  return "";
};

/**
 * Reads a fetch `Response` as JSON, turning the two failure modes that
 * otherwise surface as an opaque `Error: Failed to parse JSON` into actionable
 * messages:
 *
 * - a non-2xx status, and
 * - a 2xx status whose body is not JSON (e.g. an HTML proxy/CDN interstitial or
 *   maintenance page that slips past a plain `response.ok` check).
 *
 * The body is read exactly once, so callers must not read it themselves.
 */
export const readJsonResponse = async <T>({
  response,
  context,
}: {
  response: Response;
  context: string;
}): Promise<T> => {
  const body = await response.text();

  if (!response.ok) {
    throw new HttpResponseError({
      message: `${context} failed (${response.status} ${response.statusText}).${statusHint(response.status)}${
        body ? ` Response: ${bodySnippet(body)}` : ""
      }`,
      status: response.status,
    });
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    const contentType = response.headers.get("content-type") ?? "unknown";
    throw new HttpResponseError({
      message: `${context} returned a non-JSON response (status ${response.status}, content-type ${contentType}).${statusHint(response.status)} Response: ${
        body ? bodySnippet(body) : "(empty body)"
      }`,
      status: response.status,
    });
  }
};
