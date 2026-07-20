import { insert, remove, update } from "@orama/orama";
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
    mutationFn: dictionaryEntriesTable.addWord.mutation,
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
     */
    addDictionaryEntry: async (
      params: Parameters<typeof mutateAsync>[0],
      opts: Parameters<typeof mutateAsync>[1] = {},
      { createReverse }: { createReverse?: boolean } = {}
    ) => {
      const newWord = await mutateAsync(params, opts);

      if (params.word.tags && params.word.tags.length > 0) {
        setSuggestedTags(params.word.tags);
      }

      await flashcardsTable.createFlashcardPair.mutation({
        dictionary_entry_id: newWord.id,
        createReverse,
      });

      insert(getOramaDb(), toOramaDocument(newWord));
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

      update(getOramaDb(), updatedWord.id, toOramaDocument(updatedWord));
      reset();
    },
  };
};
