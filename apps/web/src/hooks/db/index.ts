import { insert, remove, update } from "@orama/orama";
import { useMutation } from "@tanstack/react-query";
import { createEmptyCard } from "ts-fsrs";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { queryClient } from "@/lib/query";
import { getOramaDb } from "@/lib/search";
import { nullToUndefined } from "@/lib/utils";
import { useSearch } from "../useSearch";

/**
 *  Hook for adding a new word to the local database and the search index.
 */
export const useAddDictionaryEntry = () => {
  const { reset } = useSearch();
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
     *  Adds a new word to the local database and the search index,
     *  and creates reverse and forward flashcards for the new word.
     */
    addDictionaryEntry: async (
      params: Parameters<typeof mutateAsync>[0],
      opts: Parameters<typeof mutateAsync>[1] = {}
    ) => {
      const emptyFlashcard = createEmptyCard();

      const newWord = await mutateAsync(params, opts);

      const formattedEmptyCard = {
        ...emptyFlashcard,
        due: emptyFlashcard.due.toISOString(),
        last_review: emptyFlashcard.last_review?.toISOString() ?? null,
        dictionary_entry_id: newWord.id,
      };

      await Promise.all([
        flashcardsTable.create.mutation({
          flashcard: {
            ...formattedEmptyCard,
            direction: "forward",
          },
        }),
        flashcardsTable.create.mutation({
          flashcard: {
            ...formattedEmptyCard,
            direction: "reverse",
          },
        }),
      ]);

      insert(getOramaDb(), nullToUndefined(newWord));
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

      update(getOramaDb(), updatedWord.id, nullToUndefined(updatedWord));
      reset();
    },
  };
};
