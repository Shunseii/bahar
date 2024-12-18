import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";

export const { searchClient } = instantMeiliSearch(
  import.meta.env.VITE_MEILISEARCH_API_URL!,
  import.meta.env.VITE_MEILISEARCH_API_KEY!,
);
