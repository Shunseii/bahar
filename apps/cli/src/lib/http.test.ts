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
