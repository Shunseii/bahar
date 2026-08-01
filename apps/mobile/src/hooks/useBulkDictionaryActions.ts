import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@/hooks/useSearch";
import { dictionaryEntriesTable, flashcardsTable } from "@/lib/db/operations";
import { removeFromSearchIndex, updateSearchIndex } from "@/lib/search";
import { queryClient } from "@/utils/api";

/**
 * The dictionary list's bulk actions: delete, add/remove tags, and
 * enable/disable reverse flashcards across a selection of words.
 *
 * Each action writes through the shared bulk operation, mirrors the change into
 * the Orama index (the list renders from there, not from SQLite), and
 * invalidates the caches the change can move. Mobile counterpart of the web
 * `useBulkDictionaryActions`.
 */
export const useBulkDictionaryActions = () => {
  const { reset: resetSearch } = useSearch();

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
     * Deletes every selected word along with its flashcards. Returns the ids
     * that were actually removed -- a selection can outlive an entry another
     * device deleted in the meantime.
     */
    deleteEntries: async (ids: string[]) => {
      const deleted = await bulkDelete({ ids });

      for (const entry of deleted) {
        await removeFromSearchIndex(entry.id);
      }

      await queryClient.invalidateQueries({
        queryKey: dictionaryEntriesTable.entry.cacheOptions.queryKey,
      });
      await invalidateQueueCounts();
      resetSearch();

      return deleted.map((entry) => entry.id);
    },

    /**
     * Adds or removes tags across the selection. Returns how many words
     * actually changed -- words that already had (or never had) a listed tag
     * are left alone by the operation.
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

      for (const entry of updated) {
        await updateSearchIndex(entry.id, {
          tags: entry.tags ?? undefined,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: dictionaryEntriesTable.entry.cacheOptions.queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: dictionaryEntriesTable.tags.cacheOptions.queryKey,
      });
      resetSearch();

      return updated.length;
    },

    /**
     * Enables or disables the reverse (English → Arabic) flashcard across the
     * selection. Returns how many words changed; disabling drops the reverse
     * card's review history, so callers confirm first.
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

      await queryClient.invalidateQueries({
        queryKey: flashcardsTable.findByEntryId.cacheOptions.queryKey,
      });
      await invalidateQueueCounts();

      return changed;
    },
  };
};
