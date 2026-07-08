import { describe, expect, test } from "bun:test";
import { HttpResponseError, readJsonResponse } from "./http";

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });

describe("readJsonResponse", () => {
  test("parses a JSON body on a 2xx response", async () => {
    const result = await readJsonResponse<{ hostname: string }>({
      response: jsonResponse({ hostname: "db.example.com" }),
      context: "Fetching database info",
    });

    expect(result).toEqual({ hostname: "db.example.com" });
  });

  test("throws an informative error for a non-JSON 2xx body", async () => {
    const response = new Response("<html><body>maintenance</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });

    const promise = readJsonResponse({
      response,
      context: "Fetching database info",
    });

    await expect(promise).rejects.toBeInstanceOf(HttpResponseError);
    await expect(promise).rejects.toThrow(/non-JSON response/);
    await expect(promise).rejects.toThrow(/content-type text\/html/);
    // The opaque Bun default must not leak through.
    await expect(promise).rejects.not.toThrow(/^Failed to parse JSON$/);
  });

  test("includes status and a body snippet for a non-2xx response", async () => {
    const response = new Response("Internal Server Error", {
      status: 500,
      statusText: "Internal Server Error",
    });

    const promise = readJsonResponse({
      response,
      context: "Fetching database info",
    });

    await expect(promise).rejects.toThrow(/500/);
    await expect(promise).rejects.toThrow(/Internal Server Error/);
  });

  test("adds a rate-limit hint for a 429", async () => {
    const response = new Response("Too Many Requests", { status: 429 });

    const promise = readJsonResponse({
      response,
      context: "Fetching database info",
    });

    await expect(promise).rejects.toThrow(/rate limiting|try again/i);
  });

  test("adds an auth hint for a 401", async () => {
    const response = new Response("Unauthorized", {
      status: 401,
      statusText: "Unauthorized",
    });

    const promise = readJsonResponse({
      response,
      context: "Fetching database info",
    });

    // Should point the user at `bahar login`, and still surface the raw body.
    await expect(promise).rejects.toThrow(/bahar login/);
    await expect(promise).rejects.toThrow(/Unauthorized/);
  });

  test("does not label a non-429 as rate limited just because the body says so", async () => {
    // Regression: a 401 whose body happens to contain rate-limit-ish phrasing
    // must not be reported as rate limiting (the real error was auth).
    const response = new Response("Please try again later", {
      status: 401,
      statusText: "Unauthorized",
    });

    const promise = readJsonResponse({
      response,
      context: "Fetching database info",
    });

    await expect(promise).rejects.not.toThrow(/rate limit/i);
  });

  test("exposes the status on the thrown error", async () => {
    const response = new Response("nope", { status: 503 });

    try {
      await readJsonResponse({ response, context: "Fetching database info" });
      throw new Error("expected readJsonResponse to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpResponseError);
      expect((error as HttpResponseError).status).toBe(503);
    }
  });
});
