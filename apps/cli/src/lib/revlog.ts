import type { FlashcardDirection } from "@bahar/drizzle-user-db-schemas";
import { type Grade, Rating, type ReviewLog } from "ts-fsrs";
import { API_URL } from "./config";
import { readJsonResponse } from "./http";

const RATING_TO_LABEL: Record<Grade, "again" | "hard" | "good" | "easy"> = {
  [Rating.Again]: "again",
  [Rating.Hard]: "hard",
  [Rating.Good]: "good",
  [Rating.Easy]: "easy",
};

export type RevlogInput = {
  log: ReviewLog;
  direction: FlashcardDirection;
  dictionaryEntryId: string;
};

/** Serializes an FSRS review log into the server's revlog entry shape. */
const toRevlogEntry = ({ log, direction, dictionaryEntryId }: RevlogInput) => ({
  ...log,
  due: log.due.toISOString(),
  review: log.review.toISOString(),
  rating: RATING_TO_LABEL[log.rating as Grade],
  direction,
  dictionary_entry_id: dictionaryEntryId,
});

/**
 * Posts review-log entries in a single request via `/stats/revlogs/batch`,
 * so grading N cards costs one round-trip rather than N. Mirrors the app's
 * fire-and-forget revlog post.
 */
export const postRevlogsBatch = async ({
  token,
  entries,
}: {
  token: string;
  entries: RevlogInput[];
}): Promise<void> => {
  if (entries.length === 0) return;

  const response = await fetch(new URL("/stats/revlogs/batch", API_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": token,
    },
    body: JSON.stringify({ entries: entries.map(toRevlogEntry) }),
  });

  await readJsonResponse({ response, context: "Posting review logs" });
};
