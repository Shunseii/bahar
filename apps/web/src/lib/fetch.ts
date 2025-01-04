import { TRACE_ID_HEADER, generateTraceId } from "./utils";

type Fetch = typeof fetch;

/**
 * A wrapper around fetch that adds a trace ID header to all requests.
 */
export const tracedFetch: Fetch = async (input, init) => {
  const actualInit: RequestInit = {
    ...init,
    // Ensure headers don't get overwritten by spreading them after
    headers: {
      ...(init?.headers && typeof init.headers === "object"
        ? init.headers
        : {}),

      [TRACE_ID_HEADER]: generateTraceId(),
    },
  };

  // Return fetch with our modified init object
  return fetch(input, actualInit);
};
