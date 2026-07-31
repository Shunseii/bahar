import type { TagMode, WordType } from "@bahar/drizzle-user-db-schemas";
import {
  type SearchDictionaryOptions,
  type SearchLanguage,
  type SortableProperty,
  searchDictionary,
} from "@bahar/search/database";
import type { DictionaryDocument } from "@bahar/search/schema";
import type { InternalTypedDocument, Result, Results } from "@orama/orama";
import { atom, useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOramaDb } from "@/lib/search";
import { detectLanguage } from "@/lib/utils";

export const SORT_OPTIONS = [
  "relevance",
  "updatedAt",
  "createdAt",
  "difficulty",
  "lastReviewed",
] as const;

type SortOption = (typeof SORT_OPTIONS)[number];

const SEARCH_RESULTS_PER_PAGE = 20;

const searchResultsMetadataAtom = atom<
  | (Omit<Results<InternalTypedDocument<DictionaryDocument>>, "hits"> & {
      searchTerm?: string;
    })
  | null
>(null);

const hitsAtom = atom<
  Result<InternalTypedDocument<DictionaryDocument>>[] | null
>(null);

const offsetAtom = atom(0);

/**
 * Custom hook that exposes methods for interacting with orama search
 * and the cached search results.
 */
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
      language: SearchLanguage = "english"
    ) => {
      return searchDictionary(getOramaDb(), params.term ?? "", {
        limit: SEARCH_RESULTS_PER_PAGE,
        offset: params.offset,
        language,
        where: params.where,
        sortBy: params.sortBy,
      }) as Results<InternalTypedDocument<DictionaryDocument>>;
    },
    []
  );

  const preloadResults = useCallback(() => {
    if (!(hits || searchResultsMetadata)) {
      const { hits: newHits, ...metadata } = search({}, "english");

      setHits(newHits);
      setSearchResultsMetadata(metadata);
    }
  }, [search, setHits, setSearchResultsMetadata]);

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
    /**
     * Thin wrapper around Orama's search function that uses
     * the existing oramaDb instance and is typed more accurately.
     */
    search,

    /**
     * Ensures there is data in the cache by checking if it's empty,
     * if so, then it makes a search request that populates the cache.
     */
    preloadResults,

    results:
      hits && searchResultsMetadata
        ? ({
            hits,
            ...searchResultsMetadata,
          } as Results<InternalTypedDocument<DictionaryDocument>> &
            typeof searchResultsMetadata)
        : undefined,

    /**
     * Clears the cached search results.
     */
    reset,

    /**
     * Re-runs search with fresh data from Orama and updates the cache.
     */
    refresh,
  };
};

/**
 * Custom hook that wraps orama's search to implement infinite scrolling
 * functionality and exposes helper methods for interacting with the results.
 */
export const useInfiniteScroll = (
  params: {
    term?: string;
    filters?: {
      tags?: string[];
      tagMode?: TagMode;
      types?: WordType[];
    };
    sort?: SortOption;
  } = {}
) => {
  const { search } = useSearch();

  const [hasMore, setHasMore] = useState(true);

  const [offset, setOffset] = useAtom(offsetAtom);
  const [hits, setHits] = useAtom(hitsAtom);
  const [searchResultsMetadata, setSearchResultsMetadata] = useAtom(
    searchResultsMetadataAtom
  );

  // For checking if the search params have changed
  const paramsKey = JSON.stringify(params);

  const whereFilter = useMemo<SearchDictionaryOptions["where"]>(() => {
    const tags = params.filters?.tags;
    const types = params.filters?.types;
    if (!tags?.length && !types?.length) return undefined;

    const tagFilter =
      params.filters?.tagMode === "any"
        ? { containsAny: tags }
        : { containsAll: tags };

    return {
      ...(tags?.length ? { tags: tagFilter } : {}),
      ...(types?.length ? { type: { in: types } } : {}),
    };
  }, [paramsKey]);

  const sortBy = useMemo<SearchDictionaryOptions["sortBy"]>(() => {
    if (!params.sort || params.sort === "relevance") return undefined;

    // Typed against SortableProperty because Orama only builds sort indexes for
    // those properties and throws on anything else at query time.
    const sortMap: Record<
      Exclude<SortOption, "relevance">,
      { property: SortableProperty; order: "ASC" | "DESC" }
    > = {
      createdAt: { property: "created_at_timestamp_ms", order: "DESC" },
      updatedAt: { property: "updated_at_timestamp_ms", order: "DESC" },
      difficulty: { property: "max_difficulty", order: "DESC" },
      lastReviewed: {
        property: "last_review_timestamp_ms",
        order: "DESC",
      },
    };

    return sortMap[params.sort];
  }, [paramsKey]);

  const searchQueryLanguage = useMemo<Parameters<typeof search>[1]>(() => {
    const detectedLanuage = detectLanguage(params.term ?? "");

    switch (detectedLanuage) {
      case "ar":
        return "arabic";

      case "unknown":
      case "en":
      default:
        return "english";
    }
  }, [params.term]);

  // Triggers when show more is called,
  // appending to the existing hits
  useEffect(() => {
    // Don't search when offset is 0 since it
    // was already handled in the other useEffect
    if (offset === 0) return;

    const { hits } = search(
      {
        offset,
        sortBy,
        term: params.term,
        where: whereFilter,
      },
      searchQueryLanguage
    );

    setHits((previousHits) =>
      previousHits ? [...previousHits, ...hits] : hits
    );
  }, [offset, setHits, search]);

  const lastSearchedKeyRef = useRef<string | null>(null);

  const runSearch = useCallback(() => {
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
  }, [
    search,
    sortBy,
    params.term,
    whereFilter,
    searchQueryLanguage,
    setOffset,
    setHits,
    setSearchResultsMetadata,
  ]);

  // Search when the params change, or when the shared results cache is reset to
  // null from elsewhere (e.g. grading a card closes the flashcard drawer and
  // calls reset()). Without the null case the list would sit empty forever,
  // since nothing else re-runs the search on the same route. An empty result is
  // stored as [] (not null), so a genuinely empty dictionary doesn't re-loop.
  useEffect(() => {
    const paramsChanged = lastSearchedKeyRef.current !== paramsKey;
    const wasReset = hits === null;
    if (!(paramsChanged || wasReset)) return;

    lastSearchedKeyRef.current = paramsKey;
    runSearch();
  }, [paramsKey, hits, runSearch]);

  useEffect(() => {
    if (!(hits && searchResultsMetadata)) return;

    if (hits.length >= searchResultsMetadata.count) {
      setHasMore(false);
    }
  }, [hits, searchResultsMetadata]);

  return {
    showMore: () => {
      setOffset((prevOffset) => prevOffset + SEARCH_RESULTS_PER_PAGE);
    },
    hasMore,
    results:
      hits && searchResultsMetadata
        ? ({
            ...searchResultsMetadata,
            hits,
          } as Results<InternalTypedDocument<DictionaryDocument>>)
        : undefined,
  };
};
