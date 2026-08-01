import { Button } from "@bahar/web-ui/components/button";
import { Checkbox } from "@bahar/web-ui/components/checkbox";
import { Plural, Trans } from "@lingui/react/macro";
import { Repeat, TagIcon, Trash2, X } from "lucide-react";
import { type FC, useState } from "react";
import { useSearch } from "@/hooks/search/useSearch";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { BulkReverseDialog } from "./BulkReverseDialog";
import { BulkTagsDialog } from "./BulkTagsDialog";
import { useBulkSelection } from "./state";

type OpenDialog = "add-tags" | "remove-tags" | "reverse" | "delete" | null;

/**
 * Actions strip shown in place of the dictionary header's buttons while
 * selection mode is on. "Select all" covers the words currently loaded in the
 * list, which is what the user can see and scroll through.
 */
export const BulkSelectionToolbar: FC = () => {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const { results } = useSearch();
  const { selectedIds, selectedCount, exitSelectionMode, selectAll, clear } =
    useBulkSelection();

  const loadedIds = (results?.hits ?? [])
    .map((hit) => hit.id)
    .filter((id): id is string => Boolean(id));
  const allLoadedSelected =
    loadedIds.length > 0 && loadedIds.every((id) => selectedIds.has(id));
  const ids = [...selectedIds];
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Checkbox
          aria-label={
            allLoadedSelected ? "Clear selection" : "Select all loaded words"
          }
          checked={allLoadedSelected}
          onCheckedChange={() =>
            allLoadedSelected ? clear() : selectAll(loadedIds)
          }
        />

        <span className="font-medium text-sm">
          <Plural one="# selected" other="# selected" value={selectedCount} />
        </span>

        <Button
          className="h-7 px-2 text-primary"
          onClick={() => selectAll(loadedIds)}
          size="sm"
          variant="ghost"
        >
          <Trans>Select all</Trans>
        </Button>

        {hasSelection && (
          <Button
            className="h-7 px-2 text-muted-foreground"
            onClick={clear}
            size="sm"
            variant="ghost"
          >
            <Trans>Clear</Trans>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!hasSelection}
          onClick={() => setOpenDialog("add-tags")}
          size="sm"
          variant="outline"
        >
          <TagIcon className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
          <Trans>Add tags</Trans>
        </Button>

        <Button
          disabled={!hasSelection}
          onClick={() => setOpenDialog("remove-tags")}
          size="sm"
          variant="outline"
        >
          <TagIcon className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
          <Trans>Remove tags</Trans>
        </Button>

        <Button
          disabled={!hasSelection}
          onClick={() => setOpenDialog("reverse")}
          size="sm"
          variant="outline"
        >
          <Repeat className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
          <Trans>Reverse cards</Trans>
        </Button>

        <Button
          className="text-destructive hover:text-destructive"
          disabled={!hasSelection}
          onClick={() => setOpenDialog("delete")}
          size="sm"
          variant="outline"
        >
          <Trash2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
          <Trans>Delete</Trans>
        </Button>

        <Button
          aria-label="Exit selection mode"
          onClick={exitSelectionMode}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <BulkTagsDialog
        action="add"
        ids={ids}
        onDone={clear}
        onOpenChange={(open) => setOpenDialog(open ? "add-tags" : null)}
        open={openDialog === "add-tags"}
      />
      <BulkTagsDialog
        action="remove"
        ids={ids}
        onDone={clear}
        onOpenChange={(open) => setOpenDialog(open ? "remove-tags" : null)}
        open={openDialog === "remove-tags"}
      />
      <BulkReverseDialog
        ids={ids}
        onDone={clear}
        onOpenChange={(open) => setOpenDialog(open ? "reverse" : null)}
        open={openDialog === "reverse"}
      />
      <BulkDeleteDialog
        ids={ids}
        onDone={exitSelectionMode}
        onOpenChange={(open) => setOpenDialog(open ? "delete" : null)}
        open={openDialog === "delete"}
      />
    </div>
  );
};
