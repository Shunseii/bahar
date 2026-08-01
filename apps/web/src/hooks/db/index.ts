import { getByID, insert, remove, update } from "@orama/orama";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { suggestedTagsAtom } from "@/atoms/suggested-tags";
import { dictionaryEntriesTable, flashcardsTable } from "@/lib/db/operations";
import { queryClient } from "@/lib/query";
import { getOramaDb, toOramaDocument } from "@/lib/search";
import { useSearch } from "../search/useSearch";

/**
 *  Hook for adding a new word to the local database and the search index.
 */
export const useAddDictionaryEntry = () => {
  const { reset } = useSearch();
  const setSuggestedTags = useSetAtom(suggestedTagsAtom);
  const { mutateAsync } = useMutation({
    mutationFn: dictionaryEntriesTable.addWordWithFlashcards.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
    },
  });

  return {
    /**
     *  Adds a new word to the local database and the search index, and creates
     *  its flashcards. A forward card is always created; a reverse card is
     *  created when `createReverse` is passed (the add-word form's per-word
     *  choice) or, if omitted, per the `create_reverse_by_default` setting.
     *
     *  The entry and its cards are written in one atomic operation, so a
     *  failure can't leave a word behind with no review schedule.
     */
    addDictionaryEntry: async (
      params: Parameters<typeof mutateAsync>[0],
      opts: Parameters<typeof mutateAsync>[1] = {},
      { createReverse }: { createReverse?: boolean } = {}
    ) => {
      const { entry } = await mutateAsync({ ...params, createReverse }, opts);

      if (params.word.tags && params.word.tags.length > 0) {
        setSuggestedTags(params.word.tags);
      }

      insert(getOramaDb(), toOramaDocument(entry));
      reset();
    },
  };
};

/**
 *  Hook for deleting a word from the local database and the search index.
 */
export const useDeleteDictionaryEntry = () => {
  const { reset } = useSearch();
  const { mutateAsync } = useMutation({
    mutationFn: dictionaryEntriesTable.delete.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.counts.cacheOptions.queryKey,
      });
    },
  });

  return {
    /**
     *  Deletes a word from the local database and the search index.
     */
    deleteDictionaryEntry: async (
      params: Parameters<typeof mutateAsync>[0],
      opts: Parameters<typeof mutateAsync>[1] = {}
    ) => {
      const deletedWord = await mutateAsync(params, opts);

      remove(getOramaDb(), deletedWord.id);
      reset();
    },
  };
};

/**
 *  Hook for editing a word in the local database and the search index.
 */
export const useEditDictionaryEntry = () => {
  const { reset } = useSearch();
  const { mutateAsync } = useMutation({
    mutationFn: dictionaryEntriesTable.editWord.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dictionaryEntriesTable.entry.cacheOptions.queryKey,
      });
    },
  });

  return {
    /**
     *  Edits a word in the local database and the search index.
     */
    editDictionaryEntry: async (
      params: Parameters<typeof mutateAsync>[0],
      opts: Parameters<typeof mutateAsync>[1] = {}
    ) => {
      const updatedWord = await mutateAsync(params, opts);

      // toOramaDocument omits the flashcard-derived fields (they come from the
      // flashcards table, not the dictionary entry), so carry them over from the
      // existing indexed document -- otherwise an edit would reset the
      // difficulty and recently-reviewed sort positions until the next reindex.
      const orama = getOramaDb();
      const current = getByID(orama, updatedWord.id);

      update(orama, updatedWord.id, {
        ...toOramaDocument(updatedWord),
        max_difficulty: current?.max_difficulty ?? 0,
        last_review_timestamp_ms: current?.last_review_timestamp_ms ?? 0,
      });
      reset();
    },
  };
};

/**
 *  Hook for the dictionary list's bulk actions: delete, add/remove tags, and
 *  enable/disable reverse flashcards across a selection of words.
 *
 *  Each action writes through the shared bulk operation, mirrors the change into
 *  the Orama index (the list reads its rows from there, not from SQLite), and
 *  invalidates the queue counts that the change can move.
 */
export const useBulkDictionaryActions = () => {
  const { reset } = useSearch();
  const setSuggestedTags = useSetAtom(suggestedTagsAtom);

  const invalidateQueueCounts = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.counts.cacheOptions.queryKey,
      }),
    ]);
  };

  const { mutateAsync: bulkDelete, isPending: isDeleting } = useMutation({
    mutationFn: dictionaryEntriesTable.bulkDelete.mutation,
  });

  const { mutateAsync: bulkUpdateTags, isPending: isUpdatingTags } =
    useMutation({
      mutationFn: dictionaryEntriesTable.bulkUpdateTags.mutation,
    });

  const { mutateAsync: bulkSetReverse, isPending: isUpdatingReverse } =
    useMutation({
      mutationFn: flashcardsTable.bulkSetReverse.mutation,
    });

  return {
    isPending: isDeleting || isUpdatingTags || isUpdatingReverse,

    /**
     *  Deletes every selected word along with its flashcards. Returns the ids
     *  that were actually removed -- a selection can outlive an entry that
     *  another device deleted in the meantime.
     */
    deleteEntries: async (ids: string[]) => {
      const deleted = await bulkDelete({ ids });
      const orama = getOramaDb();

      for (const entry of deleted) {
        remove(orama, entry.id);
      }

      await invalidateQueueCounts();
      reset();

      return deleted.map((entry) => entry.id);
    },

    /**
     *  Adds or removes tags across the selection. Returns how many words
     *  actually changed -- words that already had (or never had) a listed tag
     *  are left alone by the operation.
     */
    updateTags: async ({
      ids,
      tags,
      action,
    }: {
      ids: string[];
      tags: string[];
      action: "add" | "remove";
    }) => {
      const updated = await bulkUpdateTags({ ids, tags, action });
      const orama = getOramaDb();

      for (const entry of updated) {
        // Carry the flashcard-derived sort fields over, same as a single edit:
        // toOramaDocument doesn't produce them, so re-indexing without them
        // would reset the difficulty and recently-reviewed sort positions.
        const current = getByID(orama, entry.id);

        update(orama, entry.id, {
          ...toOramaDocument(entry),
          max_difficulty: current?.max_difficulty ?? 0,
          last_review_timestamp_ms: current?.last_review_timestamp_ms ?? 0,
        });
      }

      if (action === "add") {
        setSuggestedTags(tags);
      }

      await queryClient.invalidateQueries({
        queryKey: dictionaryEntriesTable.tags.cacheOptions.queryKey,
      });
      reset();

      return updated.length;
    },

    /**
     *  Enables or disables the reverse (English → Arabic) flashcard across the
     *  selection. Returns how many words changed; disabling drops the reverse
     *  card's review history, so callers confirm first.
     */
    setReverse: async ({
      ids,
      enabled,
    }: {
      ids: string[];
      enabled: boolean;
    }) => {
      const { changed } = await bulkSetReverse({
        dictionary_entry_ids: ids,
        enabled,
      });

      await invalidateQueueCounts();

      return changed;
    },
  };
};
