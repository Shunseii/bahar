import {
  ExampleSchema,
  InsertDictionaryEntrySchema,
  IsmMorphologySchema,
  RootLettersSchema,
  VerbMorphologySchema,
  type WordType,
} from "@bahar/drizzle-user-db-schemas";
import {
  type AiGatewayAdapterConfig,
  createOpenAiChat,
} from "@cloudflare/tanstack-ai";
import { chat } from "@tanstack/ai";
import Elysia from "elysia";
import { z } from "zod";
import { betterAuthGuard, type RateLimiterOpts } from "../middleware";
import { config } from "../utils/config";

const aiGatewayConfig: AiGatewayAdapterConfig = {
  accountId: config.CLOUDFLARE_ACCOUNT_ID,
  gatewayId: config.CLOUDFLARE_AI_GATEWAY_ID,
  cfApiKey: config.CF_AI_GATEWAY_TOKEN,
};

const aiAdapter = createOpenAiChat("gpt-4o", {
  ...aiGatewayConfig,
});

const aiAdapterNoCache = createOpenAiChat("gpt-4o", {
  ...aiGatewayConfig,
  skipCache: true,
});

const baseFields = {
  definition: z
    .string()
    .optional()
    .describe(
      "Arabic-only dictionary definition in the style of المعجم الوسيط — a synonym or brief explanation in Arabic. No English words, translations, or parenthetical notes."
    ),
  root: RootLettersSchema.optional().describe(
    'The base trilateral or quadrilateral root (الجذر), not augmented letters. e.g. استغفر → ["غ", "ف", "ر"], تعلّم → ["ع", "ل", "م"].'
  ),
};

const ExampleOutputSchema = ExampleSchema.omit({ context: true });

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

Tashkeel rules — apply to ALL Arabic text you produce (isolated words, definitions, etc.):
- Include full بنائية tashkeel on every word.
- NEVER add إعراب on the final letter. Strip all tanween (ًٌٍ) and any final ُ/َ/ِ that only exists for case/mood. This applies to EVERY Arabic word you output.
  ✓ كِتَاب  ✗ كِتَابٌ
  ✓ يَكْتُب  ✗ يَكْتُبُ  (present tense: no final dhamma)
  ✓ كَاتِب  ✗ كَاتِبٌ  (participle: no tanween)
  ✓ مَكْتُوب  ✗ مَكْتُوبٌ
  ✓ كُتُب  ✗ كُتُبٌ  (plural: no tanween)
  ✓ كِتَابَة  ✗ كِتَابَةٌ  (masdar: no tanween)
  ✓ يَسْتَغْفِر  ✗ يَسْتَغْفِرُ  (no final dhamma)
  Exception: diptotes (الممنوع من الصرف) show dhamma only.
- Isolated words must be indefinite — no ال.

Definition rules:
- The definition MUST be entirely in Arabic — no English, no transliterations, no parenthetical translations.
- Write a brief Arabic synonym or explanation as it would appear in المعجم الوسيط.

Morphology rules:
- Plurals must be real, well-known, attested forms. Do NOT invent or guess broken plurals.
  Example: كِتَاب → كُتُب (correct). Do NOT generate fabricated patterns like كتوب or أكتاب.
- Only include plural forms you are certain are standard Arabic. Omit the field entirely if unsure.
- Each plural entry stands alone. The "details" field is for usage context only (e.g. "formal", "colloquial"). Do NOT mention other plural forms, do NOT compare plurals, do NOT say "also exists" or "less common than".
- Omit the gender field for masadir (verbal nouns) and abstract nouns where gender is not meaningful (e.g. تقوى، صبر، عِلم).

Optional "details" and "context" fields:
- These fields (on plurals, masadir, examples, etc.) should be LEFT EMPTY by default.
- Only fill them when there is genuinely non-obvious information, such as a word being archaic, dialect-specific, or restricted to a specific register.
- Straightforward, common forms need no annotation. When in doubt, omit.

Other rules:
- Omit any field you are not confident about rather than guessing.
`;

const EXAMPLES_SYSTEM_PROMPT = `
You are an Arabic linguistics expert generating a single example sentence for a language learning app.

Generate one example sentence for the given word. Use functional tashkeel only:
- Mark shadda (ّ) always — it changes meaning.
- Vocalize ambiguous words where the consonant skeleton has multiple readings (e.g. عَلِمَ vs عَلَّمَ).
- Vocalize key vocabulary the learner is likely studying.
- Leave common, unambiguous words completely bare (في، من، على، هو، كان، etc.).
- Do NOT add i'rab (case/mood endings) to sentence words.
- Example: "قَرَأت كِتَابًا في تاريخ العالم" — only the verb and key noun are vocalized.
- Always include an English translation.
- Use the word in a natural, varied context.
`;

const aiRateLimits: RateLimiterOpts[] = [
  { prefix: "ratelimit:ai:autocomplete:min", maxReqs: 5, windowSecs: 60 },
  { prefix: "ratelimit:ai:autocomplete:hr", maxReqs: 50, windowSecs: 60 * 60 },
  {
    prefix: "ratelimit:ai:autocomplete:day",
    maxReqs: 150,
    windowSecs: 60 * 60 * 24,
  },
];

export const aiRouter = new Elysia({ prefix: "/ai" })
  .use(betterAuthGuard)
  .post(
    "/autocomplete",
    async ({ body: { translation, type, word } }) => {
      return chat({
        adapter: aiAdapter as never,
        systemPrompts: [AUTOCOMPLETE_SYSTEM_PROMPT],
        messages: [
          {
            role: "user",
            content: `Word: "${word}", Translation: "${translation}", Type: "${type}"`,
          },
        ],
        outputSchema: getOutputSchema(type),
      });
    },
    {
      auth: "user",
      planGuard: "pro",
      userRateLimit: aiRateLimits,
      body: InsertDictionaryEntrySchema.pick({
        word: true,
        translation: true,
        type: true,
      }),
    }
  )
  .post(
    "/examples",
    async ({ body: { word, translation } }) => {
      return chat({
        adapter: aiAdapterNoCache as never,
        systemPrompts: [EXAMPLES_SYSTEM_PROMPT],
        messages: [
          {
            role: "user",
            content: `Word: "${word}", Translation: "${translation}"`,
          },
        ],
        outputSchema: ExampleOutputSchema,
      });
    },
    {
      auth: "user",
      planGuard: "pro",
      userRateLimit: aiRateLimits,
      body: InsertDictionaryEntrySchema.pick({
        word: true,
        translation: true,
      }),
    }
  );
