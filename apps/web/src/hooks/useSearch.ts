import {
  type SearchDictionaryOptions,
  type SearchLanguage,
  searchDictionary,
} from "@bahar/search/database";
import type { DictionaryDocument } from "@bahar/search/schema";
import type { InternalTypedDocument, Result, Results } from "@orama/orama";
import { atom, useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOramaDb } from "@/lib/search";
import { detectLanguage } from "@/lib/utils";

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
    };
    sortBy?: SearchDictionaryOptions["sortBy"];
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
    if (!params.filters?.tags?.length) return undefined;

    return {
      tags: { containsAll: params.filters.tags },
    };
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
        sortBy: params.sortBy,
        term: params.term,
        where: whereFilter,
      },
      searchQueryLanguage
    );

    setHits((previousHits) =>
      previousHits ? [...previousHits, ...hits] : hits
    );
  }, [offset, setHits, search]);

  // Triggers when search params change,
  // resetting the pagination
  useEffect(() => {
    const { hits, ...metadata } = search(
      {
        sortBy: params.sortBy,
        term: params.term,
        where: whereFilter,
        offset: 0,
      },
      searchQueryLanguage
    );

    setOffset(0);
    setHits(hits);
    setSearchResultsMetadata({ ...metadata, searchTerm: params.term });
    setHasMore(hits.length < metadata.count);
  }, [paramsKey, setOffset, setHits, setSearchResultsMetadata, search]);

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
