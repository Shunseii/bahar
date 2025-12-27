/**
 * Search hooks for Orama.
 *
 * Provides search functionality and infinite scroll pagination.
 */

import { detectLanguage, stripArabicDiacritics } from "@bahar/search/arabic";
import type { DictionaryDocument } from "@bahar/search/schema";
import { search as oramaSearch, type Result, type Results } from "@orama/orama";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOramaDb } from "@/lib/search";

const SEARCH_RESULTS_PER_PAGE = 20;

type SearchResults = Results<DictionaryDocument>;
type SearchHit = Result<DictionaryDocument>;

interface UseSearchResult {
  search: (term: string) => SearchResults;
  reset: () => void;
}

/**
 * Hook for basic search functionality.
 */
export const useSearch = (): UseSearchResult => {
  const search = useCallback((term: string): SearchResults => {
    const tolerance = (() => {
      if (!term) return 0;
      const len = stripArabicDiacritics(term).length;
      if (len <= 2) return 0;
      if (len <= 3) return 1;
      return 2;
    })();

    const language = detectLanguage(term);
    const oramaLanguage = language === "ar" ? "arabic" : "english";

    return oramaSearch(
      getOramaDb(),
      {
        term,
        mode: "fulltext",
        limit: SEARCH_RESULTS_PER_PAGE,
        properties: term
          ? ["word", "translation", "definition", "tags"]
          : undefined,
        boost: {
          word: 10,
          translation: 10,
        },
        tolerance,
      },
      oramaLanguage
    ) as SearchResults;
  }, []);

  const reset = useCallback(() => {
    // Reset any cached state if needed
  }, []);

  return { search, reset };
};

interface UseInfiniteSearchResult {
  hits: SearchHit[];
  hasMore: boolean;
  isLoading: boolean;
  totalCount: number;
  elapsedTimeNs: number | null;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Hook for infinite scroll search.
 */
export const useInfiniteSearch = (
  searchTerm: string
): UseInfiniteSearchResult => {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [elapsedTimeNs, setElapsedTimeNs] = useState<number | null>(null);

  const oramaLanguage = useMemo(() => {
    const lang = detectLanguage(searchTerm);
    return lang === "ar" ? "arabic" : "english";
  }, [searchTerm]);

  const tolerance = useMemo(() => {
    if (!searchTerm) return 0;
    const len = stripArabicDiacritics(searchTerm).length;
    if (len <= 2) return 0;
    if (len <= 3) return 1;
    return 2;
  }, [searchTerm]);

  const performSearch = useCallback(
    (currentOffset: number, append = false) => {
      setIsLoading(true);

      try {
        const results = oramaSearch(
          getOramaDb(),
          {
            term: searchTerm,
            mode: "fulltext",
            limit: SEARCH_RESULTS_PER_PAGE,
            offset: currentOffset,
            properties: searchTerm
              ? ["word", "translation", "definition", "tags"]
              : undefined,
            boost: {
              word: 10,
              translation: 10,
            },
            tolerance,
          },
          oramaLanguage
        ) as SearchResults;

        if (append) {
          setHits((prev) => [...prev, ...results.hits]);
        } else {
          setHits(results.hits);
        }

        setTotalCount(results.count);
        setHasMore(currentOffset + results.hits.length < results.count);
        // Capture elapsed time (Orama returns it as bigint in elapsed.raw)
        if (results.elapsed?.raw !== undefined) {
          setElapsedTimeNs(Number(results.elapsed.raw));
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, tolerance, oramaLanguage]
  );

  // Reset and search when term changes
  useEffect(() => {
    setOffset(0);
    performSearch(0, false);
  }, [searchTerm, performSearch]);

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
