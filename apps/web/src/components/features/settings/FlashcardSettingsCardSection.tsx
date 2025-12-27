import { Button } from "@bahar/web-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bahar/web-ui/components/form";
import {
  RadioGroup,
  RadioGroupItem,
} from "@bahar/web-ui/components/radio-group";
import { Switch } from "@bahar/web-ui/components/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { BetaBadge } from "@/components/BetaBadge";
import { ensureDb } from "@/lib/db";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";
import { enqueueDbOperation, enqueueSyncOperation } from "@/lib/db/queue";
import { queryClient } from "@/lib/query";
import { z } from "@/lib/zod";

const FormSchema = z.object({
  show_antonyms_in_flashcard: z.enum(["hidden", "answer", "hint"]).optional(),
  show_reverse_flashcards: z.boolean().optional(),
});

export const FlashcardSettingsCardSection = () => {
  const { t } = useLingui();
  const { data } = useQuery({
    queryFn: () => settingsTable.getSettings.query(),
    ...settingsTable.getSettings.cacheOptions,
  });

  const { mutateAsync: updateSettings } = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
      });
    },
  });

  const [clearingProgress, setClearingProgress] = useState<{
    total: number;
    cleared: number;
  } | null>(null);

  const handleClearBacklog = useCallback(async () => {
    try {
      let lastProgress = { cleared: 0, total: 0 };

      await enqueueDbOperation(async () => {
        for await (const progress of flashcardsTable.clearBacklog.generator({
          showReverse: data?.show_reverse_flashcards ?? false,
        })) {
          setClearingProgress(progress);
          lastProgress = progress;
        }
      });

      await enqueueSyncOperation(async () => {
        const db = await ensureDb();
        await db.push();
        await db.checkpoint();
      });

      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });

      queryClient.invalidateQueries({
        queryKey: flashcardsTable.counts.cacheOptions.queryKey,
      });

      if (lastProgress.total === 0) {
        toast.info(t`No backlog cards to clear.`);
      } else {
        toast.success(t`Backlog cleared!`, {
          description: t`${lastProgress.cleared} cards have been rescheduled.`,
        });
      }
    } catch (err) {
      toast.error(t`Failed to clear backlog`, {
        description: t`There was an error clearing your backlog.`,
      });
    } finally {
      setClearingProgress(null);
    }
  }, [data?.show_reverse_flashcards, t]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      show_antonyms_in_flashcard: "hidden",
      show_reverse_flashcards: false,
    },
    values: {
      show_antonyms_in_flashcard: data?.show_antonyms_in_flashcard ?? "hidden",
      show_reverse_flashcards: data?.show_reverse_flashcards ?? false,
    },
  });

  const onSubmit = useCallback(
    async (formData: z.infer<typeof FormSchema>) => {
      try {
        await updateSettings({ updates: formData });

        toast.success(t`Flashcard settings updated!`);
      } catch (err) {
        toast.error(t`Failed to update flashcard settings.`, {
          description: t`There was an error updating your flashcard settings.`,
        });
      }
    },
    [updateSettings, t]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Flashcards</Trans>
        </CardTitle>

        <CardDescription>
          <Trans>Customize how flashcards appear.</Trans>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="mb-4 flex flex-col gap-y-4">
              <FormField
                control={form.control}
                name="show_antonyms_in_flashcard"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>
                      <Trans>How should antonyms be shown in flashcards?</Trans>
                    </FormLabel>

                    <FormControl>
                      <RadioGroup
                        className="flex flex-col space-y-1"
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="hidden" />
                          </FormControl>

                          <FormLabel className="cursor-pointer font-normal">
                            <Trans>Don't show</Trans>
                          </FormLabel>
                        </FormItem>

                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="hint" />
                          </FormControl>

                          <FormLabel className="cursor-pointer font-normal">
                            <Trans>Show as a hint</Trans>
                          </FormLabel>
                        </FormItem>

                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="answer" />
                          </FormControl>

                          <FormLabel className="cursor-pointer font-normal">
                            <Trans>Show after revealing the answer</Trans>
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="show_reverse_flashcards"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-x-2 text-base">
                        <Trans>Reverse flashcards</Trans>
                        <BetaBadge />
                      </FormLabel>

                      <FormDescription>
                        <Trans>Show English to Arabic flashcards.</Trans>
                      </FormDescription>
                    </div>

                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Button
              disabled={!form.formState.isDirty || form.formState.isSubmitting}
              type="submit"
            >
              <Trans>Save</Trans>
            </Button>
          </form>
        </Form>

        <div className="mt-4 border-t pt-4">
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-medium text-sm">
                  <Trans>Clear backlog</Trans>
                </p>
                <p className="text-muted-foreground text-sm">
                  <Trans>
                    Reschedule all backlog cards by grading them as "Hard".
                  </Trans>
                </p>
              </div>
              <Button
                disabled={!!clearingProgress}
                onClick={handleClearBacklog}
                variant="outline"
              >
                <Trans>Clear</Trans>
              </Button>
            </div>

            {clearingProgress && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{
                      width: `${
                        (clearingProgress.cleared / clearingProgress.total) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <p className="text-center text-muted-foreground text-xs">
                  <Trans>
                    {clearingProgress.cleared} / {clearingProgress.total} cards
                  </Trans>
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
