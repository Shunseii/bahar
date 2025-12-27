import { Trans } from "@lingui/react/macro";
import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { FormSchema } from "@/lib/schemas/dictionary";
import type { z } from "@/lib/zod";

export const AdditionalDetailsFormSection = () => {
  const form = useFormContext<z.infer<typeof FormSchema>>();

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
                    className="w-full text-xl"
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
                          className="w-full text-xl"
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
                                className="ml-1 w-[98%]"
                                // Need to do this otherwise the focus border will get cut off
                                // in the dropdown
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
                                className="ml-1 w-[98%]"
                                // Need to do this otherwise the focus border will get cut off
                                // in the dropdown
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
