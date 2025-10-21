// const { items: hits, showMore, isLastPage } = useInfiniteHits<Hit>(props);

import { atom, useAtom, useSetAtom } from "jotai";
import {
  InternalTypedDocument,
  Result,
  Results,
  search as oramaSearch,
  type SearchParams,
} from "@orama/orama";
import { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { oramaDb } from "@/lib/search";
import { useCallback, useEffect, useState } from "react";

const SEARCH_RESUTLS_PER_PAGE = 20;

const searchResultsMetadataAtom = atom<
  | Omit<Results<InternalTypedDocument<SelectDictionaryEntry>>, "hits">
  | undefined
>(undefined);

const hitsAtom = atom<
  Result<InternalTypedDocument<SelectDictionaryEntry>>[] | undefined
>(undefined);

const offsetAtom = atom(0);

/**
 * Custom hook that exposes methods for interacting with orama search
 * and the cached search results.
 */
export const useSearch = () => {
  const setOffset = useSetAtom(offsetAtom);
  const setHits = useSetAtom(hitsAtom);
  const setSearchResultsMetadata = useSetAtom(searchResultsMetadataAtom);

  const search = useCallback(
    (params: SearchParams<typeof oramaDb> = {}) =>
      // Orama's search function is sync by default,
      // but it's typed as sync or async since some plugins
      // can make it async. We cast type to sync return type
      // so it's easier to work with.
      oramaSearch(oramaDb, params) as Results<
        InternalTypedDocument<SelectDictionaryEntry>
      >,
    [],
  );

  return {
    /**
     * Thin wrapper around Orama's search function that uses
     * the existing oramaDb instance and is typed more accurately.
     */
    search,

    /**
     * Clears the cached search results.
     */
    reset: () => {
      setSearchResultsMetadata(undefined);
      setHits(undefined);
      setOffset(0);
    },
  };
};

/**
 * Custom hook that wraps orama's search to implement infinite scrolling
 * functionality and exposes helper methods for interacting with the results.
 */
export const useInfiniteScroll = (
  params: Omit<SearchParams<typeof oramaDb>, "limit" | "offset" | "mode"> = {},
) => {
  const { search } = useSearch();

  const [hasMore, setHasMore] = useState(true);

  const [offset, setOffset] = useAtom(offsetAtom);
  const [hits, setHits] = useAtom(hitsAtom);
  const [searchResultsMetadata, setSearchResultsMetadata] = useAtom(
    searchResultsMetadataAtom,
  );

  // For checking if the search params have changed
  const paramsKey = JSON.stringify(params);

  // Triggers when show more is called,
  // appending to the existing hits
  useEffect(() => {
    const { hits, ...metadata } = search({
      ...params,
      mode: "fulltext",
      limit: SEARCH_RESUTLS_PER_PAGE,
      offset,
    });

    // If offset is 0, that means search params changed
    // and so we reset the hits instead of appending to it
    // and also set the search results metadata
    if (offset === 0) {
      setHits(hits);

      setSearchResultsMetadata(metadata);
    } else {
      setHits((previousHits) =>
        previousHits ? [...previousHits, ...hits] : hits,
      );
    }
  }, [offset, setHits, setSearchResultsMetadata, search]);

  // Triggers when search params change,
  // resetting the pagination
  useEffect(() => {
    setOffset(0);
  }, [paramsKey, setOffset]);

  useEffect(() => {
    if (!hits || !searchResultsMetadata) return;

    if (hits.length === searchResultsMetadata.count) {
      setHasMore(false);
    }
  }, [hits, searchResultsMetadata]);

  return {
    showMore: () => {
      setOffset((prevOffset) => prevOffset + SEARCH_RESUTLS_PER_PAGE);
    },
    hasMore,
    results: {
      ...searchResultsMetadata,
      hits,
    } as Results<InternalTypedDocument<SelectDictionaryEntry>>,
  };
};
