import { Button } from "@bahar/web-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bahar/web-ui/components/dropdown-menu";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { ChevronUp, Repeat, TagIcon, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FC, useState } from "react";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { BulkReverseDialog } from "./BulkReverseDialog";
import { BulkTagsDialog } from "./BulkTagsDialog";
import { useBulkSelection, useSelectionScope } from "./state";

type OpenDialog = "add-tags" | "remove-tags" | "reverse" | "delete" | null;

/**
 * Actions for the current selection, pinned to the viewport rather than placed
 * in the dictionary header: the selection stays live while the user scrolls the
 * list, so its actions have to stay reachable too.
 */
export const BulkSelectionBar: FC = () => {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const { matchingCount, outsideResultsCount, allSelected } =
    useSelectionScope();
  const {
    selectionMode,
    selectedIds,
    selectedCount,
    exitSelectionMode,
    selectAll,
    clear,
  } = useBulkSelection();

  const ids = [...selectedIds];
  const hasSelection = selectedCount > 0;

  // Same actions in both layouts, so the narrow bar can't drift from the wide
  // one. Tags stays a menu in both -- add and remove are two destinations
  // behind one control.
  const actions = [
    {
      key: "reverse",
      label: <Trans>Reverse</Trans>,
      icon: Repeat,
      onClick: () => setOpenDialog("reverse"),
      destructive: false,
    },
    {
      key: "delete",
      label: <Trans>Delete</Trans>,
      icon: Trash2,
      onClick: () => setOpenDialog("delete"),
      destructive: true,
    },
  ];

  const selectAllLabel = allSelected ? (
    <Trans>Clear</Trans>
  ) : (
    <Plural one="Select all #" other="Select all #" value={matchingCount} />
  );

  // The count goes unsaid on the narrow bar: it shares a row with the exit
  // button and the selected count, and a five-digit dictionary pushed the row
  // wider than the card.
  const selectAllLabelShort = allSelected ? (
    <Trans>Clear</Trans>
  ) : (
    <Trans>Select all</Trans>
  );

  const countLabel = (
    <Plural one="# selected" other="# selected" value={selectedCount} />
  );

  const secondaryLine =
    outsideResultsCount > 0 ? (
      <Plural
        one="# not in these results"
        other="# not in these results"
        value={outsideResultsCount}
      />
    ) : selectedCount === 0 ? (
      <Trans>Click entries to select them</Trans>
    ) : null;

  const tagsMenu = (
    <DropdownMenuContent align="center" side="top">
      <DropdownMenuItem onSelect={() => setOpenDialog("add-tags")}>
        <TagIcon className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
        <Trans>Add tags</Trans>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setOpenDialog("remove-tags")}>
        <TagIcon className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
        <Trans>Remove tags</Trans>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <>
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            animate={{ y: 0, opacity: 1 }}
            className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6"
            exit={{ y: 16, opacity: 0 }}
            initial={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Narrow viewports get the same two-row card the native app uses:
                a single pill can't hold a count, select-all and three actions
                without wrapping into an uneven stack, and the actions end up
                too small to hit with a thumb. */}
            <div className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-border bg-background/95 shadow-lg supports-backdrop-filter:bg-background/80 supports-backdrop-filter:backdrop-blur sm:hidden">
              <div className="flex items-center gap-3 border-border/60 border-b px-3 py-2">
                <Button
                  aria-label={t`Exit selection mode`}
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={exitSelectionMode}
                  size="icon"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>

                {/* Fixed height with the contents centred, so gaining or losing
                    the second line doesn't change the bar's height and shift
                    the actions under the user's thumb. */}
                <div className="flex h-9 flex-1 flex-col justify-center">
                  <span className="font-semibold text-sm tabular-nums">
                    {countLabel}
                  </span>
                  {secondaryLine && (
                    <span className="truncate text-muted-foreground text-xs">
                      {secondaryLine}
                    </span>
                  )}
                </div>

                <Button
                  className="h-8 shrink-0 whitespace-nowrap rounded-full px-2 font-semibold text-primary text-xs"
                  onClick={() => (allSelected ? clear() : selectAll())}
                  size="sm"
                  variant="ghost"
                >
                  {selectAllLabelShort}
                </Button>
              </div>

              <div className="flex items-center px-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-auto flex-1 flex-col gap-1 rounded-xl py-2.5"
                      disabled={!hasSelection}
                      variant="ghost"
                    >
                      <TagIcon className="h-5 w-5" />
                      <span className="font-medium text-xs">
                        <Trans>Tags</Trans>
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  {tagsMenu}
                </DropdownMenu>

                {actions.map(
                  ({ key, label, icon: Icon, onClick, destructive }) => (
                    <Button
                      className={
                        destructive
                          ? "h-auto flex-1 flex-col gap-1 rounded-xl py-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          : "h-auto flex-1 flex-col gap-1 rounded-xl py-2.5"
                      }
                      disabled={!hasSelection}
                      key={key}
                      onClick={onClick}
                      variant="ghost"
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium text-xs">{label}</span>
                    </Button>
                  )
                )}
              </div>
            </div>

            <div className="pointer-events-auto hidden flex-wrap items-center gap-2 rounded-full border border-border bg-background/95 py-2 shadow-lg supports-backdrop-filter:bg-background/80 supports-backdrop-filter:backdrop-blur sm:flex ltr:pr-2 ltr:pl-4 rtl:pr-4 rtl:pl-2">
              <span className="whitespace-nowrap font-medium text-sm tabular-nums">
                {countLabel}
              </span>

              {outsideResultsCount > 0 && (
                <span className="whitespace-nowrap text-muted-foreground text-xs">
                  <Plural
                    one="# not in these results"
                    other="# not in these results"
                    value={outsideResultsCount}
                  />
                </span>
              )}

              <Button
                className="h-8 whitespace-nowrap rounded-full px-2 text-primary text-xs"
                onClick={() => (allSelected ? clear() : selectAll())}
                size="sm"
                variant="ghost"
              >
                {selectAllLabel}
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
                {tagsMenu}
              </DropdownMenu>

              {actions.map(
                ({ key, label, icon: Icon, onClick, destructive }) => (
                  <Button
                    className={
                      destructive
                        ? "h-8 rounded-full px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        : "h-8 rounded-full px-3"
                    }
                    disabled={!hasSelection}
                    key={key}
                    onClick={onClick}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
                    {label}
                  </Button>
                )
              )}

              <span className="h-5 w-px bg-border" />

              <Button
                aria-label={t`Exit selection mode`}
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
