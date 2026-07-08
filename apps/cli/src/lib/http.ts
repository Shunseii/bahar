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

const looksRateLimited = ({
  status,
  body,
}: {
  status: number;
  body: string;
}): boolean =>
  status === 429 ||
  status === 503 ||
  /rate limit|too many requests|try again/i.test(body);

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
    const hint = looksRateLimited({ status: response.status, body })
      ? " The server is rate limiting or temporarily unavailable — wait a moment and try again."
      : "";
    throw new HttpResponseError({
      message: `${context} failed (${response.status} ${response.statusText}).${hint}${
        body ? ` Response: ${bodySnippet(body)}` : ""
      }`,
      status: response.status,
    });
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    const contentType = response.headers.get("content-type") ?? "unknown";
    const hint = looksRateLimited({ status: response.status, body })
      ? " This looks like a rate-limit or maintenance page — wait a moment and try again."
      : " The server returned a non-JSON response, which usually means a proxy/CDN error or maintenance page.";
    throw new HttpResponseError({
      message: `${context} returned a non-JSON response (status ${response.status}, content-type ${contentType}).${hint}${
        body ? ` Response: ${bodySnippet(body)}` : ""
      }`,
      status: response.status,
    });
  }
};
