import { Button } from "@bahar/web-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bahar/web-ui/components/dropdown-menu";
import { Plural, Trans } from "@lingui/react/macro";
import { ChevronUp, Repeat, TagIcon, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FC, useState } from "react";
import { useSearch } from "@/hooks/search/useSearch";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { BulkReverseDialog } from "./BulkReverseDialog";
import { BulkTagsDialog } from "./BulkTagsDialog";
import { useBulkSelection } from "./state";

type OpenDialog = "add-tags" | "remove-tags" | "reverse" | "delete" | null;

/**
 * Actions for the current selection, pinned to the viewport rather than placed
 * in the dictionary header: the selection stays live while the user scrolls the
 * list, so its actions have to stay reachable too.
 */
export const BulkSelectionBar: FC = () => {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const { results } = useSearch();
  const {
    selectionMode,
    selectedIds,
    selectedCount,
    exitSelectionMode,
    selectAll,
    clear,
  } = useBulkSelection();

  const totalCount = results?.count ?? 0;
  const allSelected = totalCount > 0 && selectedCount >= totalCount;
  const ids = [...selectedIds];
  const hasSelection = selectedCount > 0;

  return (
    <>
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            animate={{ y: 0, opacity: 1 }}
            className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
            exit={{ y: 16, opacity: 0 }}
            initial={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-border bg-background/95 py-2 shadow-lg supports-backdrop-filter:bg-background/80 supports-backdrop-filter:backdrop-blur ltr:pr-2 ltr:pl-4 rtl:pr-4 rtl:pl-2">
              <span className="whitespace-nowrap font-medium text-sm tabular-nums">
                <Plural
                  one="# selected"
                  other="# selected"
                  value={selectedCount}
                />
              </span>

              <Button
                className="h-8 whitespace-nowrap rounded-full px-2 text-primary text-xs"
                onClick={() => (allSelected ? clear() : selectAll())}
                size="sm"
                variant="ghost"
              >
                {allSelected ? (
                  <Trans>Clear</Trans>
                ) : (
                  <Plural
                    one="Select all #"
                    other="Select all #"
                    value={totalCount}
                  />
                )}
              </Button>

              <span className="h-5 w-px bg-border" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="h-8 rounded-full px-3"
                    disabled={!hasSelection}
                    size="sm"
                    variant="ghost"
                  >
                    <TagIcon className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                    <Trans>Tags</Trans>
                    <ChevronUp className="h-3.5 w-3.5 opacity-60 ltr:ml-1 rtl:mr-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top">
                  <DropdownMenuItem onSelect={() => setOpenDialog("add-tags")}>
                    <TagIcon className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    <Trans>Add tags</Trans>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setOpenDialog("remove-tags")}
                  >
                    <TagIcon className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    <Trans>Remove tags</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                className="h-8 rounded-full px-3"
                disabled={!hasSelection}
                onClick={() => setOpenDialog("reverse")}
                size="sm"
                variant="ghost"
              >
                <Repeat className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                <Trans>Reverse</Trans>
              </Button>

              <Button
                className="h-8 rounded-full px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={!hasSelection}
                onClick={() => setOpenDialog("delete")}
                size="sm"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                <Trans>Delete</Trans>
              </Button>

              <span className="h-5 w-px bg-border" />

              <Button
                aria-label="Exit selection mode"
                className="h-8 w-8 rounded-full"
                onClick={exitSelectionMode}
                size="icon"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </>
  );
};
