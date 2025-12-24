import { Trans } from "@lingui/react/macro";
import { BetaBadge } from "@/components/BetaBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/useToast";
import { queryClient } from "@/lib/query";
import { trpc } from "@/lib/trpc";
import { z } from "@/lib/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLingui } from "@lingui/react/macro";
import { getQueryKey } from "@trpc/react-query";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ensureDb } from "@/lib/db";
import { enqueueDbOperation, enqueueSyncOperation } from "@/lib/db/queue";
import { settingsTable } from "@/lib/db/operations/settings";
import { flashcardsTable } from "@/lib/db/operations/flashcards";

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
  const { mutateAsync: updateSettingsRemote } =
    trpc.settings.update.useMutation({
      onSuccess: (serverData) => {
        queryClient.setQueryData(
          getQueryKey(trpc.settings.get, undefined, "query"),
          serverData,
        );
      },
    });

  const { mutateAsync: updateSettingsLocal } = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
      });
    },
  });

  const { toast } = useToast();
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
        toast({ title: t`No backlog cards to clear.` });
      } else {
        toast({
          title: t`Backlog cleared!`,
          description: t`${lastProgress.cleared} cards have been rescheduled.`,
        });
      }
    } catch (err) {
      toast({
        title: t`Failed to clear backlog`,
        description: t`There was an error clearing your backlog.`,
      });
    } finally {
      setClearingProgress(null);
    }
  }, [data?.show_reverse_flashcards, t, toast]);

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
        await Promise.all([
          updateSettingsRemote(formData),
          updateSettingsLocal({ updates: formData }),
        ]);

        toast({
          title: t`Flashcard settings updated!`,
        });
      } catch (err) {
        toast({
          title: t`Failed to update flashcard settings.`,
          description: t`There was an error updating your flashcard settings.`,
        });
      }
    },
    [updateSettingsRemote, updateSettingsLocal, t, toast],
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
            <div className="flex flex-col gap-y-4 mb-4">
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
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="hidden" />
                          </FormControl>

                          <FormLabel className="font-normal cursor-pointer">
                            <Trans>Don't show</Trans>
                          </FormLabel>
                        </FormItem>

                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="hint" />
                          </FormControl>

                          <FormLabel className="font-normal cursor-pointer">
                            <Trans>Show as a hint</Trans>
                          </FormLabel>
                        </FormItem>

                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="answer" />
                          </FormControl>

                          <FormLabel className="font-normal cursor-pointer">
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
                      <FormLabel className="text-base flex items-center gap-x-2">
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
              type="submit"
              disabled={!form.formState.isDirty || form.formState.isSubmitting}
            >
              <Trans>Save</Trans>
            </Button>
          </form>
        </Form>

        <div className="border-t pt-4 mt-4">
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  <Trans>Clear backlog</Trans>
                </p>
                <p className="text-sm text-muted-foreground">
                  <Trans>
                    Reschedule all backlog cards by grading them as "Hard".
                  </Trans>
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleClearBacklog}
                disabled={!!clearingProgress}
              >
                <Trans>Clear</Trans>
              </Button>
            </div>

            {clearingProgress && (
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
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
                <p className="text-xs text-muted-foreground text-center">
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
