import { router, protectedProcedure } from "../trpc";
import { meilisearchClient } from "../clients/meilisearch";
import { Card, createEmptyCard } from "ts-fsrs";
import { z } from "zod";
import { DictionarySchema } from "../schemas/dictionary.schema";
import { FlashcardSchema } from "../schemas/flashcard.schema";
import { SelectDecksSchema } from "../db/schema/decks";
import { MultiSearchQueryWithFederation } from "meilisearch";
import { JSON_SCHEMA_FIELDS } from "./dictionary";

export const FLASHCARD_LIMIT = 100;

export enum FlashcardState {
  NEW = 0,
  LEARNING = 1,
  REVIEW = 2,
  RE_LEARNING = 3,
}

export type Flashcard = Card & {
  id: string;
  due: string;
  last_review: string | null;
  due_timestamp: number;
  last_review_timestamp: number | null;
};

const FilterSchema = SelectDecksSchema.pick({ filters: true });

const TodaySchema = FilterSchema.extend({
  filters: FilterSchema.shape.filters.optional(),
  show_reverse: z.boolean().default(false).optional(),
}).optional();

export const flashcardRouter = router({
  today: protectedProcedure
    .input(TodaySchema)
    .output(
      z.object({
        total_hits: z.number(),
        flashcards: z.array(
          z.object({
            flashcard: FlashcardSchema,
            reverse: z.boolean(),
            card: DictionarySchema.pick({
              id: true,
              word: true,
              type: true,
              translation: true,
              tags: true,
              morphology: true,
              definition: true,
              examples: true,
              root: true,
              antonyms: true,
            }),
          }),
        ),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { show_reverse, filters } = input ?? {};

      const { flashcards: dictionaryWords, totalHits } = await queryFlashcards({
        user_id: user.id,
        limit: FLASHCARD_LIMIT,
        filters,
        show_reverse,
      });

      return {
        total_hits: totalHits,
        flashcards: dictionaryWords.map(
          ({
            id,
            word,
            type,
            translation,
            flashcard,
            reverse,
            morphology,
            definition,
            examples,
            root,
            tags,
            antonyms,
          }) => {
            return {
              flashcard: flashcard ?? getEmptyFlashcard(id),
              reverse,
              card: {
                id,
                word,
                type,
                translation,
                morphology,
                definition,
                examples,
                root,
                tags,
                antonyms,
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
          flashcard_reverse: undefined,
        },
      ]);

      await meilisearchClient.index(user.id).waitForTask(taskUid);

      return {
        id,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reverse: z.boolean(),
        flashcard: FlashcardSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const { id, reverse, flashcard } = input;

      const flashcardFieldToUpdate = reverse
        ? "flashcard_reverse"
        : "flashcard";

      const { taskUid } = await meilisearchClient
        .index(user.id)
        .updateDocuments([
          {
            id,
            [flashcardFieldToUpdate]: {
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

type OutputFlashcards = z.infer<typeof DictionarySchema> & {
  reverse?: boolean;
};

export const queryFlashcards = async ({
  user_id,
  fields,
  show_only_today = true,
  limit = 1000,
  filters,
  show_reverse = false,
}: {
  user_id: string;
  filters?: z.infer<typeof FilterSchema>["filters"];
  fields?: string[];
  show_only_today?: boolean;
  limit?: number;
  show_reverse?: boolean;
}) => {
  const types = filters?.types?.length
    ? filters?.types.map((type) => {
        if (type === "fi'l") {
          return '"fi\'l"';
        }

        return type;
      })
    : ["ism", '"fi\'l"', "harf", "expression"];

  const tags = filters?.tags?.map((tag) => `"${tag}"`) ?? [];

  /**
   * Current timestamp in seconds
   */
  const now = Math.floor(new Date().getTime() / 1000);

  const fieldsToRetrieve = fields ?? JSON_SCHEMA_FIELDS;

  const queries: MultiSearchQueryWithFederation[] = [
    {
      indexUid: user_id,
      limit,
      sort: ["flashcard.due_timestamp:asc"],
      attributesToRetrieve: fieldsToRetrieve.filter(
        (field) => field !== "flashcard_reverse",
      ),
      filter: [
        show_only_today
          ? `flashcard.due_timestamp NOT EXISTS OR flashcard.due_timestamp <= ${now}`
          : "",
        `type IN [${types.join(", ")}]`,
        tags?.length ? `tags IN [${tags.join(", ")}]` : "",
      ],
    },
    ...(show_reverse
      ? [
          {
            indexUid: user_id,
            limit,
            sort: ["flashcard_reverse.due_timestamp:asc"],
            attributesToRetrieve: fieldsToRetrieve.filter(
              (field) => field !== "flashcard",
            ),
            filter: [
              show_only_today
                ? `flashcard_reverse.due_timestamp NOT EXISTS OR flashcard_reverse.due_timestamp <= ${now}`
                : "",
              `type IN [${types.join(", ")}]`,
              tags?.length ? `tags IN [${tags.join(", ")}]` : "",
            ],
          },
        ]
      : []),
  ];

  const [forwardFlashcardResults, reverseFlashcardResults] = (
    await meilisearchClient.multiSearch<z.infer<typeof DictionarySchema>>({
      queries,
    })
  ).results;

  const totalHits =
    (forwardFlashcardResults?.estimatedTotalHits ?? 0) +
    (reverseFlashcardResults?.estimatedTotalHits ?? 0);

  const allFlashcards = [
    ...forwardFlashcardResults.hits,
    ...(reverseFlashcardResults?.hits?.map((f) => ({ ...f, reverse: true })) ??
      []),
  ]
    .sort((a, b) => {
      const aTimestamp =
        a.flashcard?.due_timestamp ?? a.flashcard_reverse?.due_timestamp;

      const bTimestamp =
        b.flashcard?.due_timestamp ?? b.flashcard_reverse?.due_timestamp;

      // For sorting, we want to review overdue cards first rather than prioritizing
      // new ones.
      if (aTimestamp == null && bTimestamp == null) return 0; // maintain relative order of new cards
      if (aTimestamp == null) return 1; // a goes later (is new)
      if (bTimestamp == null) return -1; // b goes later (is new)

      return aTimestamp - bTimestamp;
    })
    .slice(0, limit);

  const flashcards = allFlashcards as OutputFlashcards[];

  /**
   * An array of flashcards where both flashcards and reversed flashcards use the
   * `flashcard` field to store the flashcard data but with an additional `reverse` field
   * to indicate the direction of each.
   */
  const normalizedFlashcards = flashcards.map((card) => {
    const { flashcard, flashcard_reverse, ...fields } = card;
    const isReverse = !!fields.reverse;

    return {
      ...fields,
      flashcard: isReverse ? flashcard_reverse : flashcard,
      reverse: isReverse,
    };
  });

  return {
    flashcards: normalizedFlashcards,
    totalHits,
  };
};

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
