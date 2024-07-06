import { router, protectedProcedure } from "../trpc";
import { meilisearchClient } from "../clients/meilisearch";
import { Card, createEmptyCard } from "ts-fsrs";
import { z } from "zod";

export type Flashcard = Card & {
  id: string;
  content: string;
  translation: string;
  due: string;
  last_review: string | null;
  due_timestamp: number;
  last_review_timestamp: number | null;
};

const FlashcardSchema = z.object({
  id: z.string(),
  content: z.string(),
  translation: z.string(),
  elapsed_days: z.number(),
  lapses: z.number(),
  reps: z.number(),
  scheduled_days: z.number(),
  stability: z.number(),
  state: z.number(),
  difficulty: z.number(),
  due: z.string(),
  due_timestamp: z.number(),
  last_review: z.string().nullable(),
  last_review_timestamp: z.number().nullable(),
});

export const flashcardRouter = router({
  today: protectedProcedure
    .output(
      z.object({
        flashcards: z.array(FlashcardSchema),
      }),
    )
    .query(async ({ ctx }) => {
      const { user } = ctx;

      /**
       * Current timestamp in seconds
       */
      const now = Math.floor(new Date().getTime() / 1000);

      const { results } = await meilisearchClient.index(user.id).getDocuments({
        filter: [
          `flashcard.due_timestamp NOT EXISTS OR flashcard.due_timestamp <= ${now}`,
        ],
        limit: 1000,
      });

      const flashcards: Flashcard[] = results.map(
        ({ id, word, translation, flashcard }) => {
          const card = flashcard ?? getEmptyFlashcard(id);

          return {
            id,
            content: word,
            translation,
            ...card,
          };
        },
      );

      return {
        flashcards,
      };
    }),

  update: protectedProcedure
    .input(FlashcardSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const { id, ...flashcard } = input;

      const { taskUid } = await meilisearchClient
        .index(user.id)
        .updateDocuments([
          {
            id,
            flashcard,
          },
        ]);

      await meilisearchClient.index(user.id).waitForTask(taskUid);

      return {
        id,
        ...flashcard,
      };
    }),
});

const getEmptyFlashcard = (id: string): Flashcard => {
  return createEmptyCard(new Date(), (c) => {
    const due = new Date(c.due);
    const last_review = c.last_review ? new Date(c.last_review) : null;

    const due_timestamp = Math.floor(due.getTime() / 1000);
    const last_review_timestamp = last_review
      ? Math.floor(last_review.getTime() / 1000)
      : null;

    return {
      ...c,
      id,
      due: due.toISOString(),
      last_review: last_review?.toISOString() ?? null,
      due_timestamp,
      last_review_timestamp,
    } as Flashcard;
  });
};
