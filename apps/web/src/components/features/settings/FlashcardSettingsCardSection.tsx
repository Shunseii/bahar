import {
  clampPostponeWindow,
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  DEFAULT_POSTPONE_WINDOW_DAYS,
  enqueueDbOperation,
  enqueueSyncOperation,
  MIN_POSTPONE_WINDOW_DAYS,
  type PostponeScope,
  postponeCardsPerDay,
} from "@bahar/db-operations";
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
import { Input } from "@bahar/web-ui/components/input";
import { Label } from "@bahar/web-ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@bahar/web-ui/components/radio-group";
import { Switch } from "@bahar/web-ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Sentry from "@sentry/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { BetaBadge } from "@/components/BetaBadge";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { ensureDb } from "@/lib/db";
import { flashcardsTable, settingsTable } from "@/lib/db/operations";
import { queryClient } from "@/lib/query";
import { z } from "@/lib/zod";

const FormSchema = z.object({
  show_antonyms_in_flashcard: z.enum(["hidden", "answer", "hint"]).optional(),
  create_reverse_by_default: z.boolean().optional(),
});

export const FlashcardSettingsCardSection = () => {
  const { t } = useLingui();
  const { formatNumber } = useFormatNumber();
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

  const [postponeProgress, setPostponeProgress] = useState<{
    total: number;
    postponed: number;
  } | null>(null);
  const [postponeScope, setPostponeScope] = useState<PostponeScope>("all");
  // Held as the raw string so the field can be empty mid-edit instead of
  // snapping back to a number the moment the user clears it.
  const [windowInput, setWindowInput] = useState(
    String(DEFAULT_POSTPONE_WINDOW_DAYS)
  );

  const { data: counts } = useQuery({
    queryFn: () => flashcardsTable.counts.query(),
    ...flashcardsTable.counts.cacheOptions,
  });

  const scopeCount =
    (postponeScope === "all" ? counts?.total : counts?.backlog) ?? 0;
  const hasNothingToPostpone = scopeCount === 0;

  const parsedWindow = Number(windowInput);
  const isWindowValid =
    windowInput.trim() !== "" &&
    Number.isInteger(parsedWindow) &&
    parsedWindow >= MIN_POSTPONE_WINDOW_DAYS &&
    parsedWindow ===
      clampPostponeWindow({
        windowDays: parsedWindow,
        cardCount: scopeCount,
      });

  const windowDays = clampPostponeWindow({
    windowDays: parsedWindow,
    cardCount: scopeCount,
  });
  const cardsPerDay = postponeCardsPerDay({
    cardCount: scopeCount,
    windowDays,
  });

  // A window longer than the pile leaves days empty, so the count is the real
  // ceiling until it passes MAX_POSTPONE_WINDOW_DAYS.
  const maxWindow = clampPostponeWindow({
    windowDays: Number.POSITIVE_INFINITY,
    cardCount: scopeCount,
  });

  // Switching scope changes the count, which can drop the ceiling below what's
  // currently typed -- re-clamp rather than silently postponing out of range.
  const handleScopeChange = useCallback(
    (value: string) => {
      const nextScope = value as PostponeScope;
      const nextCount =
        (nextScope === "all" ? counts?.total : counts?.backlog) ?? 0;

      setPostponeScope(nextScope);
      setWindowInput((current) =>
        String(
          clampPostponeWindow({
            windowDays: Number(current),
            cardCount: nextCount,
          })
        )
      );
    },
    [counts]
  );

  const handlePostpone = useCallback(async () => {
    try {
      let lastProgress = { postponed: 0, total: 0 };

      await enqueueDbOperation(async () => {
        for await (const progress of flashcardsTable.postpone.generator({
          scope: postponeScope,
          windowDays,
        })) {
          setPostponeProgress(progress);
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
        toast.info(t`No overdue cards to reschedule.`);
      } else {
        toast.success(t`Backlog rescheduled!`, {
          description: t`${lastProgress.postponed} cards have been spread over the next ${windowDays} days.`,
        });
      }
    } catch (err) {
      // A failed postpone rolls back, so without this the only trace is a
      // toast the user dismisses.
      Sentry.captureException(err, {
        tags: { operation: "postpone" },
      });
      toast.error(t`Failed to reschedule backlog`, {
        description: t`There was an error rescheduling your backlog.`,
      });
    } finally {
      setPostponeProgress(null);
    }
  }, [t, postponeScope, windowDays]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      show_antonyms_in_flashcard: "hidden",
      create_reverse_by_default: false,
    },
    values: {
      show_antonyms_in_flashcard: data?.show_antonyms_in_flashcard ?? "hidden",
      create_reverse_by_default: data?.create_reverse_by_default ?? false,
    },
  });

  const onSubmit = useCallback(
    async (formData: z.infer<typeof FormSchema>) => {
      try {
        await updateSettings({ updates: formData });

        toast.success(t`Flashcard settings updated!`);
      } catch (_err) {
        toast.error(t`Failed to update flashcard settings.`, {
          description: t`There was an error updating your flashcard settings.`,
        });
      }
    },
    [updateSettings, t]
  );

  return (
    <Card>
      <CardHeader id="flashcards">
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
                name="create_reverse_by_default"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-x-2 text-base">
                        <Trans>Create reverse cards by default</Trans>
                        <BetaBadge />
                      </FormLabel>

                      <FormDescription>
                        <Trans>
                          New words get an English → Arabic reverse card. You
                          can still turn reverse on or off per word.
                        </Trans>
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
          <Link
            className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            to="/settings/card-appearance"
          >
            <div className="space-y-0.5">
              <p className="font-medium text-sm">
                <Trans>Card appearance</Trans>
              </p>
              <p className="text-muted-foreground text-sm">
                <Trans>
                  Choose which fields show on each side of your cards, and in
                  what order.
                </Trans>
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>

        <div className="mt-4 border-t pt-4">
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="font-medium text-sm">
                <Trans>Reschedule backlog</Trans>
              </p>
              <p className="text-muted-foreground text-sm">
                {postponeScope === "all" ? (
                  <Trans>
                    Spread your overdue cards evenly across the days ahead. Your
                    progress on each card is untouched.
                  </Trans>
                ) : (
                  <Trans>
                    Spread your backlog cards evenly across the days ahead.
                    Cards overdue by less than {DEFAULT_BACKLOG_THRESHOLD_DAYS}{" "}
                    days stay due today. Your progress on each card is
                    untouched.
                  </Trans>
                )}
              </p>
            </div>

            <RadioGroup
              className="flex flex-col space-y-1"
              onValueChange={handleScopeChange}
              value={postponeScope}
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem id="postpone-scope-all" value="all" />
                <Label
                  className="cursor-pointer font-normal"
                  htmlFor="postpone-scope-all"
                >
                  <Trans>
                    All overdue cards ({formatNumber(counts?.total ?? 0)})
                  </Trans>
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <RadioGroupItem id="postpone-scope-backlog" value="backlog" />
                <Label
                  className="cursor-pointer font-normal"
                  htmlFor="postpone-scope-backlog"
                >
                  <Trans>
                    Backlog only ({formatNumber(counts?.backlog ?? 0)})
                  </Trans>
                </Label>
              </div>
            </RadioGroup>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="font-normal" htmlFor="postpone-window">
                  <Trans>Spread over</Trans>
                </Label>
                <Input
                  className="w-20"
                  disabled={hasNothingToPostpone}
                  id="postpone-window"
                  inputMode="numeric"
                  max={maxWindow}
                  min={MIN_POSTPONE_WINDOW_DAYS}
                  onChange={(event) => setWindowInput(event.target.value)}
                  type="number"
                  value={windowInput}
                />
                <span className="text-muted-foreground text-sm">
                  <Trans>days</Trans>
                </span>
              </div>

              {/* "14 days" means nothing to someone deciding; "53 cards a day"
                  is the number they can actually say yes or no to. */}
              {!hasNothingToPostpone && isWindowValid && (
                <p className="text-muted-foreground text-xs">
                  <Trans>about {formatNumber(cardsPerDay)} cards per day</Trans>
                </p>
              )}
            </div>

            {hasNothingToPostpone ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Disabled buttons don't emit pointer events, so the
                      trigger has to wrap it to get a hoverable target. */}
                  <span className="self-start">
                    <Button disabled variant="outline">
                      <Trans>Reschedule</Trans>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {postponeScope === "all" ? (
                    <Trans>You have no overdue cards to reschedule.</Trans>
                  ) : (
                    <Trans>You have no backlog cards to reschedule.</Trans>
                  )}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                className="self-start"
                disabled={!!postponeProgress || !isWindowValid}
                onClick={handlePostpone}
                variant="outline"
              >
                <Trans>Reschedule</Trans>
              </Button>
            )}

            {postponeProgress && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{
                      width: `${
                        (postponeProgress.postponed / postponeProgress.total) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <p className="text-center text-muted-foreground text-xs">
                  <Trans>
                    {postponeProgress.postponed} / {postponeProgress.total}{" "}
                    cards
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
