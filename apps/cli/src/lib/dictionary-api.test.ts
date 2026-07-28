import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  addWords,
  deleteWords,
  editWords,
  gradeFlashcards,
} from "./dictionary-api";
import { HttpResponseError } from "./http";

type RecordedRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
};

const originalFetch = globalThis.fetch;

let requests: RecordedRequest[] = [];

/**
 * Replaces fetch with a stub that records the request and replies with
 * `response`, so each test asserts on the wire contract (verb, path, auth
 * header, payload shape) rather than on a live server.
 */
const stubFetch = (response: Response) => {
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });

    return response;
  }) as typeof fetch;
};

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });

beforeEach(() => {
  requests = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("addWords", () => {
  test("posts the whole batch in one request and returns the added words", async () => {
    const added = [
      {
        id: "entry-1",
        word: "نور",
        flashcardIds: { forward: "fc-1", reverse: null },
      },
    ];
    stubFetch(jsonResponse({ added }));

    const result = await addWords({
      token: "bahar_cli_test",
      words: [
        { word: "نور", translation: "light", type: "ism" },
        { word: "قلم", translation: "pen", type: "ism" },
      ],
    });

    expect(result).toEqual({ added });
    expect(requests).toHaveLength(1);

    const [request] = requests;
    expect(request.method).toBe("POST");
    expect(request.url).toEndWith("/dictionary/entries");
    expect(request.headers.get("x-api-key")).toBe("bahar_cli_test");
    expect(request.body).toEqual({
      words: [
        { word: "نور", translation: "light", type: "ism" },
        { word: "قلم", translation: "pen", type: "ism" },
      ],
    });
  });

  test("surfaces a failed response as an HttpResponseError", async () => {
    stubFetch(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" })
    );

    const promise = addWords({
      token: "stale-token",
      words: [{ word: "نور", translation: "light", type: "ism" }],
    });

    await expect(promise).rejects.toBeInstanceOf(HttpResponseError);
    await expect(promise).rejects.toThrow(/Adding words failed \(401/);
    // The 401 hint tells the user how to recover.
    await expect(promise).rejects.toThrow(/bahar login/);
  });
});

describe("editWords", () => {
  test("PATCHes the edits and passes through edited/missing", async () => {
    stubFetch(
      jsonResponse({
        edited: [{ id: "entry-1", word: "نور", updated: ["translation"] }],
        missing: ["nope"],
      })
    );

    const result = await editWords({
      token: "bahar_cli_test",
      edits: [
        { id: "entry-1", updates: { translation: "light, glow" } },
        { id: "nope", updates: { translation: "x" } },
      ],
    });

    expect(result.missing).toEqual(["nope"]);
    expect(requests[0].method).toBe("PATCH");
    expect(requests[0].url).toEndWith("/dictionary/entries");
    expect(requests[0].body).toEqual({
      edits: [
        { id: "entry-1", updates: { translation: "light, glow" } },
        { id: "nope", updates: { translation: "x" } },
      ],
    });
  });
});

describe("deleteWords", () => {
  test("sends the ids as a DELETE body", async () => {
    stubFetch(
      jsonResponse({ deleted: [{ id: "entry-1", word: "نور" }], missing: [] })
    );

    await deleteWords({ token: "bahar_cli_test", ids: ["entry-1"] });

    expect(requests[0].method).toBe("DELETE");
    expect(requests[0].url).toEndWith("/dictionary/entries");
    expect(requests[0].body).toEqual({ ids: ["entry-1"] });
  });
});

describe("gradeFlashcards", () => {
  test("sends grade labels and the caller's timezone", async () => {
    stubFetch(
      jsonResponse({
        graded: [
          { id: "fc-1", due: "2026-07-28T00:00:00.000Z", grade: "good" },
        ],
        missing: [],
      })
    );

    await gradeFlashcards({
      token: "bahar_cli_test",
      grades: [{ id: "fc-1", grade: "good" }],
    });

    const body = requests[0].body as {
      grades: { id: string; grade: string }[];
      timezone: string;
    };

    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toEndWith("/dictionary/flashcards/grade");
    expect(body.grades).toEqual([{ id: "fc-1", grade: "good" }]);
    // The streak's day boundary is the user's, not the server's, so the
    // machine timezone has to travel with the request.
    expect(body.timezone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  });
});
