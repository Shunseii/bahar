import { router, protectedProcedure } from "../trpc";
import { meilisearchClient } from "../clients/meilisearch";
import { Card, createEmptyCard } from "ts-fsrs";
import { z } from "zod";
import { DictionarySchema } from "../schemas/dictionary.schema";
import { FlashcardSchema } from "../schemas/flashcard.schema";

export type Flashcard = Card & {
  id: string;
  due: string;
  last_review: string | null;
  due_timestamp: number;
  last_review_timestamp: number | null;
};

export const flashcardRouter = router({
  today: protectedProcedure
    .output(
      z.object({
        flashcards: z.array(
          z.object({
            flashcard: FlashcardSchema,
            card: DictionarySchema.pick({
              id: true,
              word: true,
              type: true,
              translation: true,
              morphology: true,
              definition: true,
              examples: true,
              root: true,
            }),
          }),
        ),
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

      const dictionaryWords = results as z.infer<typeof DictionarySchema>[];

      return {
        flashcards: dictionaryWords.map(
          ({
            id,
            word,
            type,
            translation,
            flashcard,
            morphology,
            definition,
            examples,
            root,
          }) => {
            return {
              flashcard: flashcard ?? getEmptyFlashcard(id),
              card: {
                id,
                word,
                type,
                translation,
                morphology,
                definition,
                examples,
                root,
              },
            };
          },
        ),
      };
    }),

  reset: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const { id } = input;

      const userIndex = meilisearchClient.index(user.id);

      const document = await userIndex.getDocument(id);

      const { taskUid } = await userIndex.addDocuments([
        {
          ...document,
          flashcard: undefined,
        },
      ]);

      await meilisearchClient.index(user.id).waitForTask(taskUid);

      return {
        id,
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
            flashcard: {
              ...flashcard,
              id,
            },
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
