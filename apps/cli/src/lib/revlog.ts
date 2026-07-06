import type { FlashcardDirection } from "@bahar/drizzle-user-db-schemas";
import { type Grade, Rating, type ReviewLog } from "ts-fsrs";
import { API_URL } from "./config";

const RATING_TO_LABEL: Record<Grade, "again" | "hard" | "good" | "easy"> = {
  [Rating.Again]: "again",
  [Rating.Hard]: "hard",
  [Rating.Good]: "good",
  [Rating.Easy]: "easy",
};

/**
 * Posts a review-log entry to the server-side stats table (central API DB,
 * keyed by user). Mirrors the mobile app's fire-and-forget revlog post.
 */
export const postRevlog = async ({
  token,
  log,
  direction,
  dictionaryEntryId,
}: {
  token: string;
  log: ReviewLog;
  direction: FlashcardDirection;
  dictionaryEntryId: string;
}): Promise<void> => {
  await fetch(new URL("/stats/revlogs", API_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": token,
    },
    body: JSON.stringify({
      ...log,
      due: log.due.toISOString(),
      review: log.review.toISOString(),
      rating: RATING_TO_LABEL[log.rating as Grade],
      direction,
      dictionary_entry_id: dictionaryEntryId,
    }),
  });
};
