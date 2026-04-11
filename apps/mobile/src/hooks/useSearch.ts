/**
 * Search hooks using shared searchDictionary from @bahar/search.
 *
 * Provides two-pass exact-then-fuzzy search with filter and sort support.
 */

import { detectLanguage } from "@bahar/search/arabic";
import {
  type SearchDictionaryOptions,
  searchDictionary,
} from "@bahar/search/database";
import type { DictionaryDocument } from "@bahar/search/schema";
import type { InternalTypedDocument, Result, Results } from "@orama/orama";
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

const SORT_MAP: Record<string, { property: string; order: "ASC" | "DESC" }> = {
  createdAt: { property: "created_at_timestamp_ms", order: "DESC" },
  updatedAt: { property: "updated_at_timestamp_ms", order: "DESC" },
  difficulty: { property: "max_difficulty", order: "DESC" },
};

export const useInfiniteSearch = (
  params: UseInfiniteSearchParams = {}
): UseInfiniteSearchResult => {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [elapsedTimeNs, setElapsedTimeNs] = useState<number | null>(null);

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

  const performSearch = useCallback(
    (currentOffset: number, append = false) => {
      setIsLoading(true);

      try {
        const results = searchDictionary(getOramaDb(), params.term ?? "", {
          limit: SEARCH_RESULTS_PER_PAGE,
          offset: currentOffset,
          language,
          where: whereFilter,
          sortBy,
        }) as SearchResults;

        if (append) {
          setHits((prev) => [...prev, ...results.hits]);
        } else {
          setHits(results.hits);
        }

        setTotalCount(results.count);
        setHasMore(currentOffset + results.hits.length < results.count);
        if (results.elapsed?.raw !== undefined) {
          setElapsedTimeNs(Number(results.elapsed.raw));
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [params.term, language, whereFilter, sortBy]
  );

  useEffect(() => {
    setOffset(0);
    setHits([]);
    setHasMore(false);
    setIsLoading(true);
    const id = requestAnimationFrame(() => {
      performSearch(0, false);
    });
    return () => cancelAnimationFrame(id);
  }, [paramsKey, performSearch]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    const newOffset = offset + SEARCH_RESULTS_PER_PAGE;
    setOffset(newOffset);
    performSearch(newOffset, true);
  }, [offset, isLoading, hasMore, performSearch]);

  const refresh = useCallback(() => {
    setOffset(0);
    performSearch(0, false);
  }, [performSearch]);

  return {
    hits,
    hasMore,
    isLoading,
    totalCount,
    elapsedTimeNs,
    loadMore,
    refresh,
  };
};
