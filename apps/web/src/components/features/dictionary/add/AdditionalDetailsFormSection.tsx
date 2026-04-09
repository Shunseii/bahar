import { cn } from "@bahar/design-system";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@bahar/web-ui/components/accordion";
import { Button } from "@bahar/web-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bahar/web-ui/components/form";
import { Input } from "@bahar/web-ui/components/input";
import { Separator } from "@bahar/web-ui/components/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { useUserPlan } from "@/hooks/useUserPlan";
import { api } from "@/lib/api";
import type { FormSchema } from "@/lib/schemas/dictionary";
import type { z } from "@/lib/zod";

export const AdditionalDetailsFormSection = () => {
  const { t } = useLingui();
  const form = useFormContext<z.infer<typeof FormSchema>>();
  const { isProUser } = useUserPlan();

  const {
    fields: examplesFields,
    append: appendExample,
    remove: removeExample,
  } = useFieldArray({
    name: "examples",
    control: form.control,
  });

  const {
    fields: antonymsFields,
    append: appendAntonym,
    remove: removeAntonym,
  } = useFieldArray({
    name: "antonyms",
    control: form.control,
  });

  const { watch } = form;
  const type = watch("type");

  const hasMorphology = type === "fi'l" || type === "ism";
  const hasAntonyms = type === "ism" || type === "fi'l" || type === "harf";

  const word = form.watch("word");
  const translation = form.watch("translation");

  const generateExample = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.ai.examples.post({ word, translation });
      if (error) throw error;
      return data;
    },
    onError: (error) => {
      const status = (error as { status?: number }).status;
      if (status === 429) {
        toast.error(t`Rate limit reached`, {
          description: t`Please wait before trying again.`,
        });
      } else {
        toast.error(t`Failed to generate example`, {
          description: t`Something went wrong. Please try again.`,
        });
      }
    },
    onSuccess: (data) => {
      if (!data?.sentence) return;
      appendExample(data);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Additional Details</Trans>
        </CardTitle>

        <CardDescription>
          <Trans>
            Information such as the word's root, meaning, and examples.
          </Trans>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3">
          <FormField
            control={form.control}
            name="definition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Definition</Trans>
                </FormLabel>

                <FormControl>
                  <Input
                    className="w-full text-xl!"
                    dir="rtl"
                    lang="ar"
                    type="text"
                    {...field}
                  />
                </FormControl>

                <FormDescription>
                  <Trans>An Arabic definition of the word.</Trans>
                </FormDescription>

                <FormMessage />
              </FormItem>
            )}
          />

          <AnimatePresence>
            {hasMorphology ? (
              <motion.div
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                }}
                initial={{
                  opacity: 0,
                }}
              >
                <FormField
                  control={form.control}
                  name="root"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Root letters</Trans>
                      </FormLabel>

                      <FormControl>
                        <Input
                          className="w-full text-xl!"
                          dir="rtl"
                          lang="ar"
                          placeholder="ف ع ل"
                          type="text"
                          {...field}
                        />
                      </FormControl>

                      <FormDescription>
                        <Trans>
                          The root letters of the word. The input can be
                          separated by commas, spaces or have no delimeter ex.
                          فعل or ف, ع, ل or ف ع ل.
                        </Trans>
                      </FormDescription>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            ) : undefined}
          </AnimatePresence>

          <Separator />

          <div className="grid gap-3">
            <h3 className="font-medium">
              <Trans>Examples</Trans>
            </h3>

            <p className="text-muted-foreground ltr:text-sm rtl:text-base">
              <Trans>Example usages of the word in different contexts.</Trans>
            </p>

            <Accordion collapsible type="single">
              {examplesFields.map((field, index) => {
                return (
                  <AccordionItem key={field.id} value={field.id}>
                    <AccordionTrigger>
                      <Trans>Example {index + 1}</Trans>
                    </AccordionTrigger>

                    <AccordionContent className="flex flex-col gap-y-2">
                      <FormField
                        control={form.control}
                        name={`examples.${index}.sentence` as const}
                        render={({ field: renderField }) => (
                          <FormItem>
                            <FormLabel>
                              <Trans>Sentence</Trans>*
                            </FormLabel>

                            <FormControl>
                              <Input
                                // Need to do this otherwise the focus border will get cut off
                                // in the dropdown
                                className="w-[98%] text-xl ltr:ml-1 rtl:mr-1"
                                dir="rtl"
                                lang="ar"
                                type="text"
                                {...renderField}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`examples.${index}.translation` as const}
                        render={({ field: renderField }) => (
                          <FormItem>
                            <FormLabel>
                              <Trans>Translation</Trans>
                            </FormLabel>

                            <FormControl>
                              <Input
                                // Need to do this otherwise the focus border will get cut off
                                // in the dropdown
                                className="w-[98%] ltr:ml-1 rtl:mr-1"
                                type="text"
                                {...renderField}
                              />
                            </FormControl>

                            <FormDescription>
                              <Trans>
                                An English translation of the sentence.
                              </Trans>
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`examples.${index}.context` as const}
                        render={({ field: renderField }) => (
                          <FormItem>
                            <FormLabel>
                              <Trans>Context</Trans>
                            </FormLabel>

                            <FormControl>
                              <Input
                                // Need to do this otherwise the focus border will get cut off
                                // in the dropdown
                                className="w-[98%] ltr:ml-1 rtl:mr-1"
                                type="text"
                                {...renderField}
                              />
                            </FormControl>

                            <FormDescription>
                              <Trans>
                                The context of the sentence, ex. formal or
                                colloquial.
                              </Trans>
                            </FormDescription>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        className="w-max"
                        onClick={() => removeExample(index)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Trans>Remove</Trans>
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <div className="flex gap-2">
              <Button
                className="w-max"
                onClick={() => {
                  appendExample({ sentence: "" });
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                <Trans>Add example</Trans>
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      className="relative w-max overflow-hidden"
                      disabled={
                        !isProUser ||
                        !word ||
                        !translation ||
                        generateExample.isPending
                      }
                      onClick={() => generateExample.mutate()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {generateExample.isPending && (
                        <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                      )}
                      <Sparkles
                        className={cn(
                          "mr-2 h-4 w-4",
                          generateExample.isPending && "animate-pulse"
                        )}
                      />
                      {generateExample.isPending ? (
                        <Trans>Generating...</Trans>
                      ) : (
                        <Trans>Generate example</Trans>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>

                {!isProUser && (
                  <TooltipContent>
                    <Trans>Upgrade to Pro to generate examples.</Trans>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>

          {hasAntonyms && (
            <div className="grid gap-3">
              <h3 className="font-medium">
                <Trans>Antonyms</Trans>
              </h3>

              <p className="text-muted-foreground ltr:text-sm rtl:text-base">
                <Trans>Words that have the opposite meaning.</Trans>
              </p>

              <Accordion collapsible type="single">
                {antonymsFields.map((field, index) => {
                  return (
                    <AccordionItem key={field.id} value={field.id}>
                      <AccordionTrigger>
                        <Trans>Antonym {index + 1}</Trans>
                      </AccordionTrigger>

                      <AccordionContent className="flex flex-col gap-y-2">
                        <FormField
                          control={form.control}
                          name={`antonyms.${index}.word` as const}
                          render={({ field: renderField }) => (
                            <FormItem>
                              <FormLabel>
                                <Trans>Word</Trans>*
                              </FormLabel>

                              <FormControl>
                                <Input
                                  className="w-[98%] text-xl ltr:ml-1 rtl:mr-1"
                                  // Need to do this otherwise the focus border will get cut off
                                  // in the dropdown
                                  dir="rtl"
                                  lang="ar"
                                  type="text"
                                  {...renderField}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          className="w-max"
                          onClick={() => removeAntonym(index)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Trans>Remove</Trans>
                        </Button>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              <Button
                className="w-max"
                onClick={() => {
                  appendAntonym({ word: "" });
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                <Trans>Add antonym</Trans>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
