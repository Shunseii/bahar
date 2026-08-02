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
import { Label } from "@bahar/web-ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@bahar/web-ui/components/radio-group";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Repeat, TriangleAlert } from "lucide-react";
import { type FC, useState } from "react";
import { toast } from "sonner";
import { useBulkDictionaryActions } from "@/hooks/db";
import { flashcardsTable } from "@/lib/db/operations";

interface BulkReverseDialogProps {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export const BulkReverseDialog: FC<BulkReverseDialogProps> = ({
  ids,
  open,
  onOpenChange,
  onDone,
}) => {
  const [mode, setMode] = useState<"enable" | "disable">("enable");
  const { setReverse, isPending } = useBulkDictionaryActions();

  const { data: withReverse } = useQuery({
    queryFn: () =>
      flashcardsTable.reverseCountForEntries.query({
        dictionary_entry_ids: ids,
      }),
    queryKey: [
      ...flashcardsTable.reverseCountForEntries.cacheOptions.queryKey,
      ids,
    ],
    enabled: open,
  });

  const withoutReverse =
    withReverse === undefined ? undefined : ids.length - withReverse;

  const close = () => {
    setMode("enable");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    try {
      const changed = await setReverse({ ids, enabled: mode === "enable" });

      toast.success(
        mode === "enable"
          ? t`Reverse cards enabled for ${changed} entries`
          : t`Reverse cards removed from ${changed} entries`
      );
      close();
      onDone();
    } catch {
      toast.error(t`Failed to update reverse cards`);
    }
  };

  const options = [
    {
      value: "enable" as const,
      label: t`Enable for all`,
      description:
        withoutReverse === undefined
          ? t`Creates a reverse card for the selected entries that don't have one.`
          : t`Creates a reverse card for the ${withoutReverse} selected entries that don't have one. Entries that already have one are untouched.`,
    },
    {
      value: "disable" as const,
      label: t`Disable for all`,
      description:
        withReverse === undefined
          ? t`Deletes the reverse card of the selected entries that have one, along with its review history.`
          : t`Deletes the reverse card of the ${withReverse} selected entries that have one, along with its review history.`,
    },
  ];

  return (
    <Dialog
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      open={open}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            <Plural
              one="Reverse cards for # entry"
              other="Reverse cards for # entries"
              value={ids.length}
            />
          </DialogTitle>
          <DialogDescription>
            <Trans>
              A reverse card asks English → Arabic. Reverse cards exist per
              entry, so this only changes the entries that need it.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          className="gap-3"
          onValueChange={(value) => setMode(value as "enable" | "disable")}
          value={mode}
        >
          {options.map((option) => (
            // The whole card is the label, so clicking anywhere in it picks the
            // option -- a 3-line card whose only hit target is the radio and its
            // title reads as broken. Keyboard support still comes from the radio.
            <Label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
                mode === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border"
              )}
              htmlFor={`reverse-${option.value}`}
              key={option.value}
            >
              <RadioGroupItem
                className="mt-0.5"
                id={`reverse-${option.value}`}
                value={option.value}
              />
              <div className="flex flex-col gap-1">
                <span className="font-medium">{option.label}</span>
                <p className="text-muted-foreground text-sm">
                  {option.description}
                </p>
              </div>
            </Label>
          ))}
        </RadioGroup>

        {mode === "disable" && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40">
            <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-amber-700 text-sm dark:text-amber-300">
              <Trans>
                Disabling deletes the reverse card and its review progress. This
                can't be undone.
              </Trans>
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={close} variant="outline">
            <Trans>Cancel</Trans>
          </Button>
          <Button
            disabled={isPending}
            onClick={handleSubmit}
            variant={mode === "disable" ? "destructive" : "default"}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Plural
              one="Apply to # entry"
              other="Apply to # entries"
              value={ids.length}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
