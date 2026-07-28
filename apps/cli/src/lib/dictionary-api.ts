import type { WordInput, WordUpdates } from "@bahar/drizzle-user-db-schemas";
import { API_URL } from "./config";
import type { GradeLabel } from "./grade";
import { readJsonResponse } from "./http";

/**
 * Client for the API's dictionary write endpoints.
 *
 * Writes go through the API rather than straight to the user's database: the
 * payload is validated server-side and applied with the same operations the
 * web and mobile apps use, so a CLI write is indistinguishable from an in-app
 * one. Reads stay direct-to-database (see lib/db.ts), which is why the CLI's
 * database token only needs read access.
 *
 * Each call sends the whole batch in one request, so grading or editing N
 * items costs one round-trip.
 */
const request = async <T>({
  path,
  method,
  token,
  body,
  context,
}: {
  path: string;
  method: "POST" | "PATCH" | "DELETE";
  token: string;
  body: unknown;
  context: string;
}): Promise<T> => {
  const response = await fetch(new URL(path, API_URL), {
    method,
    headers: {
      "content-type": "application/json",
      "x-api-key": token,
    },
    body: JSON.stringify(body),
  });

  return readJsonResponse<T>({ response, context });
};

export type AddedWord = {
  id: string;
  word: string;
  flashcardIds: { forward: string; reverse: string | null };
};

export const addWords = ({
  token,
  words,
}: {
  token: string;
  words: WordInput[];
}): Promise<{ added: AddedWord[] }> =>
  request({
    path: "/dictionary/entries",
    method: "POST",
    token,
    body: { words },
    context: "Adding words",
  });

export type EditedWord = { id: string; word: string; updated: string[] };

export const editWords = ({
  token,
  edits,
}: {
  token: string;
  edits: { id: string; updates: WordUpdates }[];
}): Promise<{ edited: EditedWord[]; missing: string[] }> =>
  request({
    path: "/dictionary/entries",
    method: "PATCH",
    token,
    body: { edits },
    context: "Editing words",
  });

export type DeletedWord = { id: string; word: string };

export const deleteWords = ({
  token,
  ids,
}: {
  token: string;
  ids: string[];
}): Promise<{ deleted: DeletedWord[]; missing: string[] }> =>
  request({
    path: "/dictionary/entries",
    method: "DELETE",
    token,
    body: { ids },
    context: "Deleting words",
  });

export type GradedFlashcard = { id: string; due: string; grade: GradeLabel };

export const gradeFlashcards = ({
  token,
  grades,
}: {
  token: string;
  grades: { id: string; grade: GradeLabel }[];
}): Promise<{ graded: GradedFlashcard[]; missing: string[] }> =>
  request({
    path: "/dictionary/flashcards/grade",
    method: "POST",
    token,
    body: {
      grades,
      // The streak's day boundary belongs to the user, and the API can't infer
      // it from a request -- its own timezone is the server's.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    context: "Grading flashcards",
  });
