/**
 * Search hooks using shared searchDictionary from @bahar/search.
 *
 * Mirrors the web's useSearch / useInfiniteScroll pattern with
 * Jotai atoms for shared state so search can be reset from other screens.
 */

import { detectLanguage } from "@bahar/search/arabic";
import {
  type SearchDictionaryOptions,
  searchDictionary,
} from "@bahar/search/database";
import type { DictionaryDocument } from "@bahar/search/schema";
import type { InternalTypedDocument, Result, Results } from "@orama/orama";
import { atom, useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOramaDb } from "@/lib/search";

const SEARCH_RESULTS_PER_PAGE = 20;

export const SORT_OPTIONS = [
  "relevance",
  "updatedAt",
  "createdAt",
  "difficulty",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

type SearchResults = Results<InternalTypedDocument<DictionaryDocument>>;
type SearchHit = Result<InternalTypedDocument<DictionaryDocument>>;

type SearchResultsMetadata = Omit<SearchResults, "hits"> & {
  searchTerm?: string;
};

const SORT_MAP: Record<string, { property: string; order: "ASC" | "DESC" }> = {
  createdAt: { property: "created_at_timestamp_ms", order: "DESC" },
  updatedAt: { property: "updated_at_timestamp_ms", order: "DESC" },
  difficulty: { property: "max_difficulty", order: "DESC" },
};

const hitsAtom = atom<SearchHit[] | null>(null);
const searchResultsMetadataAtom = atom<SearchResultsMetadata | null>(null);
const offsetAtom = atom(0);

export const useSearch = () => {
  const setOffset = useSetAtom(offsetAtom);
  const [hits, setHits] = useAtom(hitsAtom);
  const [searchResultsMetadata, setSearchResultsMetadata] = useAtom(
    searchResultsMetadataAtom
  );

  const search = useCallback(
    (
      params: {
        term?: string;
        offset?: number;
        where?: SearchDictionaryOptions["where"];
        sortBy?: SearchDictionaryOptions["sortBy"];
      } = {},
      language: SearchDictionaryOptions["language"] = "english"
    ) => {
      return searchDictionary(getOramaDb(), params.term ?? "", {
        limit: SEARCH_RESULTS_PER_PAGE,
        offset: params.offset,
        language,
        where: params.where,
        sortBy: params.sortBy,
      }) as SearchResults;
    },
    []
  );

  const reset = useCallback(() => {
    setHits(null);
    setSearchResultsMetadata(null);
    setOffset(0);
  }, [setHits, setSearchResultsMetadata, setOffset]);

  const refresh = useCallback(() => {
    const { hits: newHits, ...metadata } = search({}, "english");
    setHits(newHits);
    setSearchResultsMetadata(metadata);
    setOffset(0);
  }, [search, setHits, setSearchResultsMetadata, setOffset]);

  return {
    search,
    results:
      hits && searchResultsMetadata
        ? ({ hits, ...searchResultsMetadata } as SearchResults &
            SearchResultsMetadata)
        : undefined,
    reset,
    refresh,
  };
};

interface UseInfiniteSearchParams {
  term?: string;
  filters?: {
    tags?: string[];
  };
  sort?: SortOption;
}

interface UseInfiniteSearchResult {
  hits: SearchHit[];
  hasMore: boolean;
  isLoading: boolean;
  totalCount: number;
  elapsedTimeNs: number | null;
  loadMore: () => void;
  refresh: () => void;
}

export const useInfiniteSearch = (
  params: UseInfiniteSearchParams = {}
): UseInfiniteSearchResult => {
  const { search } = useSearch();

  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [offset, setOffset] = useAtom(offsetAtom);
  const [hits, setHits] = useAtom(hitsAtom);
  const [searchResultsMetadata, setSearchResultsMetadata] = useAtom(
    searchResultsMetadataAtom
  );

  const paramsKey = JSON.stringify(params);

  const language = useMemo<SearchDictionaryOptions["language"]>(() => {
    const detected = detectLanguage(params.term ?? "");
    return detected === "ar" ? "arabic" : "english";
  }, [params.term]);

  const whereFilter = useMemo<SearchDictionaryOptions["where"]>(() => {
    if (!params.filters?.tags?.length) return undefined;
    return { tags: { containsAll: params.filters.tags } };
  }, [paramsKey]);

  const sortBy = useMemo<SearchDictionaryOptions["sortBy"]>(() => {
    if (!params.sort || params.sort === "relevance") return undefined;
    return SORT_MAP[params.sort];
  }, [paramsKey]);

  const searchQueryLanguage = useMemo(() => {
    const detected = detectLanguage(params.term ?? "");
    return detected === "ar" ? "arabic" : ("english" as const);
  }, [params.term]);

  const performSearch = useCallback(() => {
    setIsLoading(true);
    try {
      const { hits: newHits, ...metadata } = search(
        {
          sortBy,
          term: params.term,
          where: whereFilter,
          offset: 0,
        },
        searchQueryLanguage
      );

      setOffset(0);
      setHits(newHits);
      setSearchResultsMetadata({ ...metadata, searchTerm: params.term });
      setHasMore(newHits.length < metadata.count);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [search, params.term, whereFilter, sortBy, searchQueryLanguage]);

  // Re-search when params change
  useEffect(() => {
    setIsLoading(true);
    const id = requestAnimationFrame(performSearch);
    return () => cancelAnimationFrame(id);
  }, [paramsKey, performSearch]);

  // Re-search when hits are reset (e.g. after adding/editing/deleting a word)
  useEffect(() => {
    if (hits === null) {
      performSearch();
    }
  }, [hits, performSearch]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    const newOffset = offset + SEARCH_RESULTS_PER_PAGE;
    setOffset(newOffset);

    try {
      const { hits: newHits } = search(
        {
          offset: newOffset,
          sortBy,
          term: params.term,
          where: whereFilter,
        },
        searchQueryLanguage
      );

      setHits((prev) => [...(prev ?? []), ...newHits]);
    } catch (error) {
      console.error("Search error:", error);
    }
  }, [offset, isLoading, hasMore, search, params.term, whereFilter, sortBy, searchQueryLanguage]);

  const refresh = useCallback(() => {
    try {
      const { hits: newHits, ...metadata } = search(
        {
          sortBy,
          term: params.term,
          where: whereFilter,
          offset: 0,
        },
        searchQueryLanguage
      );

      setOffset(0);
      setHits(newHits);
      setSearchResultsMetadata({ ...metadata, searchTerm: params.term });
      setHasMore(newHits.length < metadata.count);
    } catch (error) {
      console.error("Search error:", error);
    }
  }, [search, params.term, whereFilter, sortBy, searchQueryLanguage]);

  return {
    hits: hits ?? [],
    hasMore,
    isLoading,
    totalCount: searchResultsMetadata?.count ?? 0,
    elapsedTimeNs:
      searchResultsMetadata?.elapsed?.raw !== undefined
        ? Number(searchResultsMetadata.elapsed.raw)
        : null,
    loadMore,
    refresh,
  };
};
