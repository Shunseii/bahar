import { Trans } from "@lingui/react/macro";
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
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { z } from "@/lib/zod";
import { FormSchema } from "@/schemas/dictionary";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

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
                    type="text"
                    lang="ar"
                    dir="rtl"
                    className="w-full text-xl"
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
                initial={{
                  opacity: 0,
                }}
                animate={{ opacity: 1 }}
                exit={{
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
                          type="text"
                          lang="ar"
                          dir="rtl"
                          placeholder="ف ع ل"
                          className="w-full text-xl"
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

            <p className="ltr:text-sm rtl:text-base text-muted-foreground">
              <Trans>Example usages of the word in different contexts.</Trans>
            </p>

            <Accordion type="single" collapsible>
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
                                type="text"
                                // Need to do this otherwise the focus border will get cut off
                                // in the dropdown
                                className="w-[98%] ltr:ml-1 rtl:mr-1 text-xl"
                                lang="ar"
                                dir="rtl"
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
                                type="text"
                                // Need to do this otherwise the focus border will get cut off
                                // in the dropdown
                                className="w-[98%] ml-1"
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
                                type="text"
                                // Need to do this otherwise the focus border will get cut off
                                // in the dropdown
                                className="w-[98%] ml-1"
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
                        variant="outline"
                        size="sm"
                        className="w-max"
                        type="button"
                        onClick={() => removeExample(index)}
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
              type="button"
              onClick={() => {
                appendExample({ sentence: "" });
              }}
              variant="outline"
              size="sm"
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

              <p className="ltr:text-sm rtl:text-base text-muted-foreground">
                <Trans>Words that have the opposite meaning.</Trans>
              </p>

              <Accordion type="single" collapsible>
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
                                  type="text"
                                  // Need to do this otherwise the focus border will get cut off
                                  // in the dropdown
                                  className="w-[98%] ltr:ml-1 rtl:mr-1 text-xl"
                                  lang="ar"
                                  dir="rtl"
                                  {...renderField}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-max"
                          type="button"
                          onClick={() => removeAntonym(index)}
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
                type="button"
                onClick={() => {
                  appendAntonym({ word: "" });
                }}
                variant="outline"
                size="sm"
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
