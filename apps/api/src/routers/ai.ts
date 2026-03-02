import { InsertDictionaryEntrySchema } from "@bahar/drizzle-user-db-schemas";
import { chat } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import Elysia from "elysia";
import { betterAuthGuard } from "../middleware";

const AUTOCOMPLETE_SYSTEM_PROMPT = `
  You are an Arabic linguistics expert. 

  Given an Arabic word or expression, its English translation, and the type (ism, fi'l, harf or expression), generate accurate dictionary data for an Arabic language learning app.

  Rules:
  - All Arabic text MUST include full tashkeel (harakat/diacritical marks)
  - Root letters: provide the trilateral or quadrilateral root as space-separated letters (e.g. "ك ت ب")
  - Only populate morphology fields relevant to the word type: ism fields for nouns, verb fields for verbs, neither for harf/expressions
  - For verbs: identify the correct form (I–X), provide the Arabic pattern (e.g. فَعَلَ), past/present/imperative with full tashkeel
  - For nouns: provide plural forms (if applicable), gender, and inflection type
  - Definition: must be in Arabic
  - Generate 2–3 example sentences at varying difficulty, each with translation and context label (if necessary)
  - Omit any field you are not confident about rather than guessing
`;

export const autocompleteRouter = new Elysia({ prefix: "/ai" })
  .use(betterAuthGuard)
  .post(
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
        outputSchema: InsertDictionaryEntrySchema.pick({
          definition: true,
          examples: true,
          morphology: true,
          root: true,
        }),
      });

      return dictionaryEntrySuggestion;
    },
    {
      body: InsertDictionaryEntrySchema.pick({
        word: true,
        translation: true,
        type: true,
      }),
    }
  );
