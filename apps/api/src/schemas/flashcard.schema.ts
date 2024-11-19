import { z } from "zod";

export enum FlashcardState {
  NEW = 0,
  LEARNING = 1,
  REVIEW = 2,
  RE_LEARNING = 3,
}

export const FlashcardSchema = z.object({
  id: z.string().optional(),
  elapsed_days: z.number(),
  lapses: z.number(),
  reps: z.number(),
  scheduled_days: z.number(),
  stability: z.number(),
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  difficulty: z.number(),
  due: z.string(),
  due_timestamp: z.number(),
  last_review: z.string().nullable(),
  last_review_timestamp: z.number().nullable(),
});
