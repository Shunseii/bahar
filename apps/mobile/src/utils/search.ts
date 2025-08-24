import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";

export const { searchClient } = instantMeiliSearch(
  process.env.EXPO_PUBLIC_VITE_MEILISEARCH_API_URL!,
  process.env.EXPO_PUBLIC_VITE_MEILISEARCH_API_KEY!,
);
