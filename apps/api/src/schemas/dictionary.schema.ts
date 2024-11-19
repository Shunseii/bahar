import { z } from "zod";
// import { Inflection } from "../routers/dictionary";
import { FlashcardSchema } from "./flashcard.schema";

// TODO: use shared schema between client and server
export const DictionarySchema = z.object({
  id: z.string().min(1),
  word: z.string().min(1),
  tags: z.array(z.string()).optional(),
  translation: z.string().min(1),
  definition: z.string().optional(),
  root: z.array(z.string()).optional(),
  antonyms: z
    .array(
      z.object({
        word: z.string(),
      })
    )
    .optional(),
  examples: z
    .array(
      z.object({
        sentence: z.string(),
        context: z.string().optional(),
        translation: z.string().optional(),
      })
    )
    .optional(),
  type: z.enum(["ism", "fi'l", "harf", "expression"]).optional(),
  flashcard: FlashcardSchema.optional().nullable(),
  flashcard_reverse: FlashcardSchema.optional().nullable(),
  morphology: z
    .object({
      ism: z
        .object({
          singular: z.string().optional(),
          dual: z.string().optional(),
          plurals: z
            .array(
              z.object({ word: z.string(), details: z.string().optional() })
            )
            .optional(),
          gender: z.enum(["masculine", "feminine"]).optional(),
          inflection: z.string().optional(),
          // TODO: fix validation error
          // inflection: z.nativeEnum(Inflection).optional(),
        })
        .optional(),
      verb: z
        .object({
          huroof: z
            .array(
              z.object({
                harf: z.string(),
                meaning: z.string().optional(),
              })
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
              })
            )
            .optional(),
          form: z.string().optional(),
          form_arabic: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// TODO: resolve this dynamically from the json schema
export const JSON_SCHEMA_FIELDS = [
  "id",
  "word",
  "definition",
  "translation",
  "type",
  "root",
  "tags",
  "antonyms",
  "examples",
  "morphology",
  "flashcard",
  "flashcard_reverse",
];
