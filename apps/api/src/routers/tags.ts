import { router, protectedProcedure } from "../trpc";
import { meilisearchClient } from "../clients/meilisearch";
import { z } from "zod";

export const tagsRouter = router({
  search: protectedProcedure
    .input(
      z
        .object({
          query: z.string().optional(),
          filter: z.array(z.string()).optional(),
        })
        .optional()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const client = meilisearchClient.index(user.id);

      const results = await client.searchForFacetValues({
        facetName: "tags",
        facetQuery: input.query,
        filter: constructTagsFilter(input.filter),
      });

      return results;
    }),
});

const constructTagsFilter = (filterTags?: string[]) => {
  return `tags NOT IN [${filterTags?.join(", ") ?? ""}]`;
};
