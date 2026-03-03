import {
  ExampleSchema,
  InsertDictionaryEntrySchema,
  IsmMorphologySchema,
  RootLettersSchema,
  VerbMorphologySchema,
  type WordType,
} from "@bahar/drizzle-user-db-schemas";
import { chat } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import Elysia from "elysia";
import { z } from "zod";
import { betterAuthGuard, type RateLimiterOpts } from "../middleware";

const baseFields = {
  definition: z
    .string()
    .optional()
    .describe(
      "Arabic dictionary definition in the style of المعجم الوسيط — a synonym or brief explanation, not a translation."
    ),
  root: RootLettersSchema.optional().describe(
    'Trilateral or quadrilateral root letters as individual characters, e.g. ["ك", "ت", "ب"].'
  ),
  examples: z.array(ExampleSchema).optional(),
};

const IsmOutputSchema = z.object({
  ...baseFields,
  morphology: IsmMorphologySchema.optional(),
});

const VerbOutputSchema = z.object({
  ...baseFields,
  morphology: VerbMorphologySchema.optional(),
});

const SimpleOutputSchema = z.object({
  ...baseFields,
});

/**
 * Separate function to return the full schema for a specific entry type.
 *
 * This is so that we can pass a smaller schema to the model for better performance.
 */
const getOutputSchema = (type: WordType) => {
  switch (type) {
    case "ism":
      return IsmOutputSchema;
    case "fi'l":
      return VerbOutputSchema;
    default:
      return SimpleOutputSchema;
  }
};

const AUTOCOMPLETE_SYSTEM_PROMPT = `
  You are an Arabic linguistics expert generating dictionary data for a language learning app.

  Rules:
  - All Arabic text MUST include full tashkeel, but omit final case endings (إعراب). Exception: diptotes (الممنوع من الصرف) should show a dhamma (not tanween) on the final letter.
  - Omit any field you are not confident about rather than guessing.
`;

const aiRateLimiterOpts: RateLimiterOpts = {
  maxReqs: 10,
  windowSecs: 60,
  prefix: "ratelimit:ai:autocomplete",
};

export const aiRouter = new Elysia({ prefix: "/ai" }).use(betterAuthGuard).post(
  "/autocomplete",
  async ({ body: { translation, type, word } }) => {
    const dictionaryEntrySuggestion = await chat({
      adapter: openaiText("gpt-4.1-nano") as never,
      systemPrompts: [AUTOCOMPLETE_SYSTEM_PROMPT],
      messages: [
        {
          role: "user",
          content: `Word: "${word}", Translation: "${translation}", Type: "${type}"`,
        },
      ],
      outputSchema: getOutputSchema(type),
    });

    return dictionaryEntrySuggestion;
  },
  {
    auth: "user",
    planGuard: "pro",
    userRateLimit: aiRateLimiterOpts,
    body: InsertDictionaryEntrySchema.pick({
      word: true,
      translation: true,
      type: true,
    }),
  }
);
