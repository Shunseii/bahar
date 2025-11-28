import { atom, useAtom, useSetAtom } from "jotai";
import {
  InternalTypedDocument,
  Result,
  Results,
  search as oramaSearch,
  type SearchParams,
} from "@orama/orama";
import { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { getOramaDb } from "@/lib/search";
import { useCallback, useEffect, useMemo, useState } from "react";
import { detectLanguage, stripArabicDiacritics } from "@/lib/utils";

const SEARCH_RESULTS_PER_PAGE = 20;

const searchResultsMetadataAtom = atom<Omit<
  Results<InternalTypedDocument<SelectDictionaryEntry>>,
  "hits"
> | null>(null);

const hitsAtom = atom<
  Result<InternalTypedDocument<SelectDictionaryEntry>>[] | null
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
    searchResultsMetadataAtom,
  );

  const search = useCallback(
    (
      params: Omit<
        SearchParams<ReturnType<typeof getOramaDb>>,
        "limit" | "mode"
      > = {},
      language: "arabic" | "english" = "english",
    ) => {
      const tolerance = (() => {
        if (!params.term) return 0;

        const len = stripArabicDiacritics(params.term).length;

        if (len <= 2) return 0;
        if (len <= 3) return 1;

        return 2;
      })();

      // Orama's search function is sync by default,
      // but it's typed as sync or async since some plugins
      // can make it async. We cast type to sync return type
      // so it's easier to work with.
      return oramaSearch(
        getOramaDb(),
        {
          ...params,
          mode: "fulltext",
          limit: SEARCH_RESULTS_PER_PAGE,
          properties: params.term
            ? ["word", "translation", "definition", "tags"]
            : undefined,
          boost: {
            word: 10,
            translation: 10,
          },
          tolerance,
        },
        language,
      ) as Results<InternalTypedDocument<SelectDictionaryEntry>>;
    },
    [],
  );

  const preloadResults = useCallback(() => {
    if (!hits && !searchResultsMetadata) {
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
          } as Results<InternalTypedDocument<SelectDictionaryEntry>>)
        : undefined,

    /**
     * Clears the cached search results.
     */
    reset,
  };
};

/**
 * Custom hook that wraps orama's search to implement infinite scrolling
 * functionality and exposes helper methods for interacting with the results.
 */
export const useInfiniteScroll = (
  params: Omit<
    SearchParams<ReturnType<typeof getOramaDb>>,
    "limit" | "offset" | "mode"
  > = {},
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
        ...params,
        offset,
      },
      searchQueryLanguage,
    );

    setHits((previousHits) =>
      previousHits ? [...previousHits, ...hits] : hits,
    );
  }, [offset, setHits, search]);

  // Triggers when search params change,
  // resetting the pagination
  useEffect(() => {
    const { hits, ...metadata } = search(
      {
        ...params,
        offset: 0,
      },
      searchQueryLanguage,
    );

    setOffset(0);
    setHits(hits);
    setSearchResultsMetadata(metadata);
    setHasMore(hits.length < metadata.count);
  }, [paramsKey, setOffset, setHits, setSearchResultsMetadata, search]);

  useEffect(() => {
    if (!hits || !searchResultsMetadata) return;

    if (hits.length === searchResultsMetadata.count) {
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
          } as Results<InternalTypedDocument<SelectDictionaryEntry>>)
        : undefined,
  };
};
