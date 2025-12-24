import { z } from "zod";

const FlashcardSchema = z
  .object({
    difficulty: z.number().gte(0).default(0),
    due: z
      .string()
      .datetime({ offset: true })
      .describe(
        "The date when the card needs to be reviewed. Set to the current time for new cards.",
      ),
    due_timestamp: z
      .number()
      .int()
      .gte(0)
      .describe(
        "A UNIX timestamp in seconds that represents the same date as `due`.",
      ),
    elapsed_days: z.number().int().gte(0).default(0),
    lapses: z.number().int().gte(0).default(0),
    last_review: z
      .union([z.string().datetime({ offset: true }), z.null()])
      .optional(),
    last_review_timestamp: z
      .union([
        z
          .number()
          .int()
          .gte(0)
          .describe(
            "A UNIX timestamp in seconds that represents the same date as `last_review`, if present.",
          ),
        z
          .null()
          .describe(
            "A UNIX timestamp in seconds that represents the same date as `last_review`, if present.",
          ),
      ])
      .describe(
        "A UNIX timestamp in seconds that represents the same date as `last_review`, if present.",
      )
      .optional(),
    reps: z.number().int().gte(0).default(0),
    scheduled_days: z.number().int().gte(0).default(0),
    stability: z.number().gte(0).default(0),
    state: z
      .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
      .describe("0 is New, 1 is Learning, 2 is Review, and 3 is Relearning.")
      .default(0),
  })
  .describe(
    "Properties used for scheduling the flashcards associated with the word using FSRS.",
  );

const FullExportSchema = z.object({
  id: z.string(),
  created_at: z.string().datetime({ offset: true }).optional(),
  created_at_timestamp: z
    .number()
    .int()
    .describe(
      "A UNIX timestamp in seconds that represents the same date as `created_at`.",
    )
    .optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
  updated_at_timestamp: z
    .number()
    .int()
    .describe(
      "A UNIX timestamp in seconds that represents the same date as `updated_at`.",
    )
    .optional(),
  word: z.string().describe("A word or expression in Arabic."),
  definition: z
    .string()
    .describe("The definition of the word in Arabic.")
    .optional(),
  translation: z.string().describe("The English translation of the word."),
  type: z
    .enum(["ism", "fi'l", "harf", "expression"])
    .describe("The type of the word.")
    .optional(),
  root: z
    .array(z.string())
    .describe("An array of letters representing the root letters of the word.")
    .optional(),
  tags: z
    .array(z.string())
    .describe(
      "Any tags associated with the word. These can denote things like the context.",
    )
    .optional(),
  antonyms: z
    .array(z.object({ word: z.string().optional() }))
    .describe("Any antonyms of the word.")
    .optional(),
  examples: z
    .array(
      z.object({
        sentence: z.string().describe("A sentence using the word."),
        context: z
          .string()
          .describe(
            "The context of the sentence. This can refer to casual or formal contexts, for example.",
          )
          .optional(),
        translation: z
          .string()
          .describe("The English translation of the sentence.")
          .optional(),
      }),
    )
    .describe("Examples using the word.")
    .optional(),
  morphology: z
    .object({
      ism: z
        .object({
          singular: z.string().optional(),
          dual: z.string().optional(),
          plurals: z
            .array(
              z.object({ word: z.string(), details: z.string().optional() }),
            )
            .optional(),
          gender: z.enum(["masculine", "feminine"]).optional(),
          inflection: z
            .enum(["indeclinable", "diptote", "triptote"])
            .optional(),
        })
        .optional(),
      verb: z
        .object({
          huroof: z
            .array(
              z.object({
                harf: z.string(),
                meaning: z.string().optional(),
              }),
            )
            .optional(),
          past_tense: z.string().optional(),
          present_tense: z.string().optional(),
          active_participle: z.string().optional(),
          passive_participle: z.string().optional(),
          imperative: z.string().optional(),
          masadir: z
            .array(
              z.object({
                word: z.string(),
                details: z.string().optional(),
              }),
            )
            .optional(),
          form: z.string().optional(),
          form_arabic: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  flashcard: FlashcardSchema.optional(),
  flashcard_reverse: FlashcardSchema.optional(),
});

export const ImportSchemaV1 = z.array(FullExportSchema);

export type ImportWordV1 = z.infer<typeof ImportSchemaV1>[number];
