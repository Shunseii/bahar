import { t } from "@lingui/core/macro";
import { z } from "@/lib/zod";

export enum Inflection {
  indeclinable = "indeclinable",
  diptote = "diptote",
  triptote = "triptote",
}

export const FormSchema = z.object({
  word: z.string().min(1, { error: () => t`This field is required.` }),
  translation: z.string().min(1, { error: () => t`This field is required.` }),
  definition: z.string().optional(),
  root: z.string().optional(),
  tags: z.array(z.object({ name: z.string() })).optional(),
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
