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
import { useCallback } from "react";
import { useForm } from "react-hook-form";

const FormSchema = z.object({
  show_antonyms_in_flashcard: z.enum(["hidden", "answer", "hint"]).optional(),
  show_reverse_flashcards: z.boolean().optional(),
});

export const FlashcardSettingsCardSection = () => {
  const { t } = useLingui();
  const { data } = trpc.settings.get.useQuery();
  const { mutate } = trpc.settings.update.useMutation({
    onSuccess: (serverData) => {
      queryClient.setQueryData(
        getQueryKey(trpc.settings.get, undefined, "query"),
        serverData,
      );
    },
  });
  const { toast } = useToast();
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

  const onSubmit = useCallback(async (data: z.infer<typeof FormSchema>) => {
    try {
      mutate(data);

      toast({
        title: t`Flashcard settings updated!`,
      });
    } catch (err) {
      toast({
        title: t`Failed to update flashcard settings.`,
        description: t`There was an error updating your flashcard settings.`,
      });
    }
  }, []);

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
      </CardContent>
    </Card>
  );
};
