import { z } from "zod";

export const FlashcardSchema = z.object({
  id: z.string().optional(),
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
