import { cn } from "@bahar/design-system";
import { Button } from "@bahar/web-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bahar/web-ui/components/dialog";
import { Input } from "@bahar/web-ui/components/input";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, Loader2, TagIcon, X } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { toast } from "sonner";
import { useBulkDictionaryActions } from "@/hooks/db";
import { dictionaryEntriesTable } from "@/lib/db/operations";

interface BulkTagsDialogProps {
  action: "add" | "remove";
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

const normalizeTag = (value: string) => value.trim();

export const BulkTagsDialog: FC<BulkTagsDialogProps> = ({
  action,
  ids,
  open,
  onOpenChange,
  onDone,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const { updateTags, isPending } = useBulkDictionaryActions();

  // Adding offers every tag in the dictionary; removing only lists tags the
  // selection actually carries, so the list can't suggest a no-op.
  const { data: tags, isPending: isLoadingTags } = useQuery({
    queryFn: () =>
      action === "add"
        ? dictionaryEntriesTable.tags.query()
        : dictionaryEntriesTable.tagsForEntries.query({ ids }),
    queryKey:
      action === "add"
        ? [...dictionaryEntriesTable.tags.cacheOptions.queryKey]
        : [...dictionaryEntriesTable.tagsForEntries.cacheOptions.queryKey, ids],
    enabled: open,
  });

  const trimmedFilter = normalizeTag(filter);

  const visibleTags = useMemo(() => {
    if (!tags) return [];
    if (!trimmedFilter) return tags;

    return tags.filter(({ tag }) =>
      tag.toLowerCase().includes(trimmedFilter.toLowerCase())
    );
  }, [tags, trimmedFilter]);

  const canCreateTag =
    action === "add" &&
    trimmedFilter.length > 0 &&
    !tags?.some(({ tag }) => tag === trimmedFilter) &&
    !selectedTags.includes(trimmedFilter);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const close = () => {
    setSelectedTags([]);
    setFilter("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    try {
      const changed = await updateTags({ ids, tags: selectedTags, action });

      toast.success(
        action === "add"
          ? t`Tags added to ${changed} entries`
          : t`Tags removed from ${changed} entries`
      );
      close();
      onDone();
    } catch {
      toast.error(
        action === "add" ? t`Failed to add tags` : t`Failed to remove tags`
      );
    }
  };

  return (
    <Dialog
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      open={open}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon
              className={cn(
                "h-4 w-4",
                action === "add" ? "text-primary" : "text-destructive"
              )}
            />
            {action === "add" ? (
              <Plural
                one="Add tags to # entry"
                other="Add tags to # entries"
                value={ids.length}
              />
            ) : (
              <Plural
                one="Remove tags from # entry"
                other="Remove tags from # entries"
                value={ids.length}
              />
            )}
          </DialogTitle>
          <DialogDescription>
            {action === "add" ? (
              <Trans>
                Tags are added to every selected entry. Tags they already have
                are left alone.
              </Trans>
            ) : (
              <Trans>
                Only tags found on the selected entries are listed. Entries
                without a tag are left unchanged.
              </Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map((tag) => (
                <button
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
                    action === "add"
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  )}
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  type="button"
                >
                  {tag}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <Input
            onChange={(event) => setFilter(event.target.value)}
            placeholder={
              action === "add"
                ? t`Search or create a tag...`
                : t`Filter tags...`
            }
            value={filter}
          />

          <div className="max-h-64 overflow-y-auto">
            {isLoadingTags && (
              <div className="flex items-center gap-2 px-1 py-3 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <Trans>Loading tags...</Trans>
              </div>
            )}

            {!isLoadingTags && visibleTags.length === 0 && !canCreateTag && (
              <p className="px-1 py-3 text-muted-foreground text-sm">
                {action === "add" ? (
                  <Trans>No tags yet. Type to create one.</Trans>
                ) : (
                  <Trans>The selected entries have no tags.</Trans>
                )}
              </p>
            )}

            <ul>
              {canCreateTag && (
                <li>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      toggleTag(trimmedFilter);
                      setFilter("");
                    }}
                    type="button"
                  >
                    <span className="text-primary">
                      <Trans>Create</Trans>
                    </span>
                    <span className="font-medium">{trimmedFilter}</span>
                  </button>
                </li>
              )}

              {visibleTags.map(({ tag, count }) => {
                const isSelected = selectedTags.includes(tag);

                return (
                  <li key={tag}>
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                        isSelected && "bg-muted/60"
                      )}
                      onClick={() => toggleTag(tag)}
                      type="button"
                    >
                      <CheckIcon
                        className={cn(
                          "h-4 w-4",
                          action === "remove" && "text-destructive",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1">{tag}</span>
                      <span className="text-muted-foreground text-xs">
                        {action === "add" ? (
                          <Plural
                            one="# entry"
                            other="# entries"
                            value={count}
                          />
                        ) : (
                          <Trans>
                            on {count} of {ids.length}
                          </Trans>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={close} variant="outline">
            <Trans>Cancel</Trans>
          </Button>
          <Button
            disabled={selectedTags.length === 0 || isPending}
            onClick={handleSubmit}
            variant={action === "add" ? "default" : "destructive"}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {action === "add" ? (
              <Plural
                one="Add # tag"
                other="Add # tags"
                value={selectedTags.length}
              />
            ) : (
              <Plural
                one="Remove # tag"
                other="Remove # tags"
                value={selectedTags.length}
              />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
