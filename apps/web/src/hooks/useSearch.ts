import type { DictionaryDocument } from "@bahar/search/schema";
import {
  type InternalTypedDocument,
  search as oramaSearch,
  type Result,
  type Results,
  type SearchParams,
} from "@orama/orama";
import { atom, useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOramaDb } from "@/lib/search";
import { detectLanguage, stripArabicDiacritics } from "@/lib/utils";

/**
 * Exact match fields - searched first with no tolerance for precise matching
 */
const EXACT_PROPERTIES = [
  "word_exact",
  "morphology.ism.singular_exact",
  "morphology.ism.plurals_exact",
  "morphology.verb.past_tense_exact",
  "morphology.verb.present_tense_exact",
  "morphology.verb.masadir_exact",
] as const;

/**
 * Normalized fields - searched with tolerance for fuzzy matching
 */
const NORMALIZED_PROPERTIES = [
  "word",
  "translation",
  "definition",
  "tags",
  "morphology.ism.plurals",
  "morphology.ism.singular",
  "morphology.verb.masadir",
  "morphology.verb.past_tense",
  "morphology.verb.present_tense",
] as const;

const SEARCH_RESULTS_PER_PAGE = 20;

const searchResultsMetadataAtom = atom<Omit<
  Results<InternalTypedDocument<DictionaryDocument>>,
  "hits"
> | null>(null);

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
      params: Omit<
        SearchParams<ReturnType<typeof getOramaDb>>,
        "limit" | "mode"
      > = {},
      language: "arabic" | "english" = "english"
    ) => {
      const db = getOramaDb();

      // No term = return all results
      if (!params.term) {
        return oramaSearch(
          db,
          { ...params, mode: "fulltext", limit: SEARCH_RESULTS_PER_PAGE },
          language
        ) as Results<InternalTypedDocument<DictionaryDocument>>;
      }

      const termLen = stripArabicDiacritics(params.term).length;

      // Two-pass search for better relevance:
      // 1. First: exact fields with low tolerance (precise matching)
      // 2. Second: normalized fields with higher tolerance (fuzzy matching)
      // Then merge results, prioritizing exact matches

      // Pass 1: Exact match search (tolerance 0-1)
      const exactTolerance = termLen <= 4 ? 0 : 1;
      const exactResults = oramaSearch(
        db,
        {
          ...params,
          mode: "fulltext",
          limit: SEARCH_RESULTS_PER_PAGE,
          properties: [...EXACT_PROPERTIES],
          tolerance: exactTolerance,
        },
        language
      ) as Results<InternalTypedDocument<DictionaryDocument>>;

      // Pass 2: Fuzzy search on normalized fields
      const fuzzyTolerance = termLen <= 2 ? 0 : termLen <= 4 ? 1 : 2;
      const fuzzyResults = oramaSearch(
        db,
        {
          ...params,
          mode: "fulltext",
          limit: SEARCH_RESULTS_PER_PAGE,
          properties: [...NORMALIZED_PROPERTIES],
          boost: {
            word: 10,
            translation: 10,
            "morphology.ism.plurals": 10,
            "morphology.ism.singular": 10,
            "morphology.verb.masadir": 10,
            "morphology.verb.past_tense": 10,
            "morphology.verb.present_tense": 10,
          },
          tolerance: fuzzyTolerance,
        },
        language
      ) as Results<InternalTypedDocument<DictionaryDocument>>;

      // Merge results: exact matches first, then fuzzy (deduplicated)
      const exactIds = new Set(exactResults.hits.map((h) => h.id));
      const mergedHits = [
        ...exactResults.hits,
        ...fuzzyResults.hits.filter((h) => !exactIds.has(h.id)),
      ].slice(0, SEARCH_RESULTS_PER_PAGE);

      return {
        elapsed: exactResults.elapsed,
        count: exactIds.size + fuzzyResults.count,
        hits: mergedHits,
      } as Results<InternalTypedDocument<DictionaryDocument>>;
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
          } as Results<InternalTypedDocument<DictionaryDocument>>)
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
  params: Omit<
    SearchParams<ReturnType<typeof getOramaDb>>,
    "limit" | "offset" | "mode"
  > = {}
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
        ...params,
        offset: 0,
      },
      searchQueryLanguage
    );

    setOffset(0);
    setHits(hits);
    setSearchResultsMetadata(metadata);
    setHasMore(hits.length < metadata.count);
  }, [paramsKey, setOffset, setHits, setSearchResultsMetadata, search]);

  useEffect(() => {
    if (!(hits && searchResultsMetadata)) return;

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
          } as Results<InternalTypedDocument<DictionaryDocument>>)
        : undefined,
  };
};
