import { Button } from "@bahar/web-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bahar/web-ui/components/dialog";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Layers, Loader2, Trash2 } from "lucide-react";
import type { FC } from "react";
import { toast } from "sonner";
import { useBulkDictionaryActions } from "@/hooks/db";
import { flashcardsTable } from "@/lib/db/operations";

interface BulkDeleteDialogProps {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export const BulkDeleteDialog: FC<BulkDeleteDialogProps> = ({
  ids,
  open,
  onOpenChange,
  onDone,
}) => {
  const { deleteEntries, isPending } = useBulkDictionaryActions();

  const { data: flashcardCount } = useQuery({
    queryFn: () =>
      flashcardsTable.countForEntries.query({ dictionary_entry_ids: ids }),
    queryKey: [...flashcardsTable.countForEntries.cacheOptions.queryKey, ids],
    enabled: open,
  });

  const handleDelete = async () => {
    try {
      const deletedIds = await deleteEntries(ids);

      toast.success(t`${deletedIds.length} words deleted`);
      onOpenChange(false);
      onDone();
    } catch {
      toast.error(t`Failed to delete words`);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            <Plural
              one="Delete # word?"
              other="Delete # words?"
              value={ids.length}
            />
          </DialogTitle>
          <DialogDescription>
            <Trans>
              This removes the words from your dictionary along with their
              flashcards and review history. This can't be undone.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            <Plural one="# word" other="# words" value={ids.length} />
          </span>
          {flashcardCount !== undefined && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
              <Layers className="h-3.5 w-3.5" />
              <Plural
                one="# flashcard"
                other="# flashcards"
                value={flashcardCount}
              />
            </span>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            <Trans>Cancel</Trans>
          </Button>
          <Button
            disabled={isPending}
            onClick={handleDelete}
            variant="destructive"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Plural
              one="Delete # word"
              other="Delete # words"
              value={ids.length}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
