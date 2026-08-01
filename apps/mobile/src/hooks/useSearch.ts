/**
 * Search hooks using shared searchDictionary from @bahar/search.
 *
 * Mirrors the web's useSearch / useInfiniteScroll pattern with
 * Jotai atoms for shared state so search can be reset from other screens.
 */

import type { TagMode, WordType } from "@bahar/drizzle-user-db-schemas";
import { detectLanguage } from "@bahar/search/arabic";
import {
  type SearchDictionaryOptions,
  type SortableProperty,
  searchDictionary,
} from "@bahar/search/database";
import type { DictionaryDocument } from "@bahar/search/schema";
import type { InternalTypedDocument, Result, Results } from "@orama/orama";
import * as Sentry from "@sentry/react-native";
import { atom, useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOramaDb } from "@/lib/search";

const SEARCH_RESULTS_PER_PAGE = 20;

export const SORT_OPTIONS = [
  "relevance",
  "updatedAt",
  "createdAt",
  "difficulty",
  "lastReviewed",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

type SearchResults = Results<InternalTypedDocument<DictionaryDocument>>;
type SearchHit = Result<InternalTypedDocument<DictionaryDocument>>;

type SearchResultsMetadata = Omit<SearchResults, "hits"> & {
  searchTerm?: string;
};

// Typed against SortableProperty because Orama only builds sort indexes for
// those properties and throws on anything else at query time.
const SORT_MAP: Record<
  Exclude<SortOption, "relevance">,
  { property: SortableProperty; order: "ASC" | "DESC" }
> = {
  createdAt: { property: "created_at_timestamp_ms", order: "DESC" },
  updatedAt: { property: "updated_at_timestamp_ms", order: "DESC" },
  difficulty: { property: "max_difficulty", order: "DESC" },
  lastReviewed: { property: "last_review_timestamp_ms", order: "DESC" },
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
    tagMode?: TagMode;
    types?: WordType[];
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

  // Guards the reset effect below from double-firing on mount: the params
  // effect already runs the first search, so the hits-reset effect should only
  // re-search when hits are nulled AFTER a search has run (an external reset).
  const hasSearchedRef = useRef(false);

  const whereFilter = useMemo<SearchDictionaryOptions["where"]>(() => {
    const tags = params.filters?.tags;
    const types = params.filters?.types;
    if (!tags?.length && !types?.length) return undefined;

    const tagFilter =
      params.filters?.tagMode === "all"
        ? { containsAll: tags }
        : { containsAny: tags };

    return {
      ...(tags?.length ? { tags: tagFilter } : {}),
      ...(types?.length ? { type: { in: types } } : {}),
    };
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
    hasSearchedRef.current = true;
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
      Sentry.captureException(error, { tags: { operation: "search" } });
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

  // Re-search when hits are reset (e.g. after adding/editing/deleting a word).
  // Skips the initial mount, where the params effect above owns the first search.
  useEffect(() => {
    if (hits === null && hasSearchedRef.current) {
      performSearch();
    }
  }, [hits, performSearch]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    const newOffset = offset + SEARCH_RESULTS_PER_PAGE;
    setOffset(newOffset);

    try {
      const { hits: newHits, ...metadata } = search(
        {
          offset: newOffset,
          sortBy,
          term: params.term,
          where: whereFilter,
        },
        searchQueryLanguage
      );

      setHits((prev) => [...(prev ?? []), ...newHits]);
      setHasMore(newOffset + newHits.length < metadata.count);
    } catch (error) {
      Sentry.captureException(error, { tags: { operation: "search" } });
    }
  }, [
    offset,
    isLoading,
    hasMore,
    search,
    params.term,
    whereFilter,
    sortBy,
    searchQueryLanguage,
  ]);

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
      Sentry.captureException(error, { tags: { operation: "search" } });
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
