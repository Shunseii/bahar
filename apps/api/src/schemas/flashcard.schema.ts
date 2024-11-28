import { z } from "zod";

export const FlashcardSchema = z
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
    "Properties used for scheduling the flashcards associated with the word using FSRS. When adding new words, just set these to the default values. For updating existing words, leave them as-is to keep flashcard progress or set to default values to reset it.",
  );
