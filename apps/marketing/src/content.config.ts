import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default("Bahar Team"),
  heroImage: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

export const collections = {
  "blog-en": defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog/en" }),
    schema: blogSchema,
  }),
  "blog-ar": defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog/ar" }),
    schema: blogSchema,
  }),
};
