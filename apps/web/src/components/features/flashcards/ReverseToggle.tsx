import { FlashcardState } from "@bahar/drizzle-user-db-schemas";
import { Button } from "@bahar/web-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bahar/web-ui/components/dialog";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@bahar/web-ui/components/segmented-control";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { flashcardsTable } from "@/lib/db/operations";
import { queryClient } from "@/lib/query";

/**
 * Per-word reverse-card toggle. Reverse existence is row presence: enabling
 * creates a fresh reverse card (due now), disabling deletes it. Disabling a
 * card that has review progress asks for confirmation first, since the delete
 * (and its FSRS history) can't be undone.
 */
export const ReverseToggle: FC<{ entryId: string }> = ({ entryId }) => {
  const { data: flashcardData } = useQuery({
    queryFn: () => flashcardsTable.findByEntryId.query(entryId),
    queryKey: [...flashcardsTable.findByEntryId.cacheOptions.queryKey, entryId],
  });

  const reverseCard = flashcardData?.find((f) => f.direction === "reverse");
  const hasReverse = Boolean(reverseCard);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: (enabled: boolean) =>
      flashcardsTable.setReverse.mutation({
        dictionary_entry_id: entryId,
        enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          ...flashcardsTable.findByEntryId.cacheOptions.queryKey,
          entryId,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.counts.cacheOptions.queryKey,
      });
    },
  });

  const handleChange = (enabled: boolean) => {
    // Only prompt when there's progress to lose; a NEW card has none, so
    // deleting it is harmless and doesn't need a confirmation.
    if (!enabled && reverseCard && reverseCard.state !== FlashcardState.NEW) {
      setConfirmOpen(true);
      return;
    }
    mutate(enabled);
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">
              <Trans>Reverse card</Trans>
            </span>
            <span className="text-muted-foreground text-xs">
              <Trans>Study English → Arabic for this word.</Trans>
            </span>
          </div>

          <SegmentedControl
            disabled={isPending}
            onValueChange={(value) => {
              // Radix emits "" when the active item is re-tapped; ignore that.
              if (value) {
                handleChange(value === "on");
              }
            }}
            type="single"
            value={hasReverse ? "on" : "off"}
          >
            <SegmentedControlItem value="off">
              <Trans>Off</Trans>
            </SegmentedControlItem>
            <SegmentedControlItem value="on">
              <Trans>On</Trans>
            </SegmentedControlItem>
          </SegmentedControl>
        </div>

        {hasReverse && (
          <p className="text-muted-foreground/70 text-xs">
            <Trans>Turning this off deletes the reverse flashcard.</Trans>
          </p>
        )}
      </div>

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Remove reverse card?</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                This deletes the reverse flashcard and its review progress. This
                action cannot be undone.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              onClick={() => setConfirmOpen(false)}
              type="button"
              variant="outline"
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              onClick={() => {
                mutate(false);
                setConfirmOpen(false);
              }}
              type="button"
              variant="destructive"
            >
              <Trans>Remove</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
