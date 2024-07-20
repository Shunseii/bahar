import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
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
import { z } from "@/lib/zod";
import { FormSchema } from "@/routes/_app-layout/dictionary/add/route.lazy";
import { Trans } from "@lingui/macro";
import { Plus } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

export const VerbMorphologyCardSection = () => {
  const form = useFormContext<z.infer<typeof FormSchema>>();

  const {
    fields: masadirFields,
    append: appendMasdar,
    remove: removeMasdar,
  } = useFieldArray({
    name: "morphology.verb.masadir",
    control: form.control,
  });

  const {
    fields: huroofFields,
    append: appendHarf,
    remove: removeHarf,
  } = useFieldArray({
    name: "morphology.verb.huroof",
    control: form.control,
  });

  return (
    <CardContent>
      <div className="grid gap-3">
        <FormField
          control={form.control}
          name="morphology.verb.past_tense"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Past tense</Trans>
              </FormLabel>

              <FormControl>
                <Input
                  type="text"
                  dir="rtl"
                  className="w-full text-xl"
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="morphology.verb.present_tense"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Present tense</Trans>
              </FormLabel>

              <FormControl>
                <Input
                  type="text"
                  dir="rtl"
                  className="w-full text-xl"
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="morphology.verb.imperative"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Imperative</Trans>
              </FormLabel>

              <FormControl>
                <Input
                  type="text"
                  dir="rtl"
                  className="w-full text-xl"
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="morphology.verb.active_participle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Active participle</Trans>
              </FormLabel>

              <FormControl>
                <Input
                  type="text"
                  dir="rtl"
                  className="w-full text-xl"
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="morphology.verb.passive_participle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Passive participle</Trans>
              </FormLabel>

              <FormControl>
                <Input
                  type="text"
                  dir="rtl"
                  className="w-full text-xl"
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <h3 className="font-medium">
          <Trans>Masadir</Trans>
        </h3>

        <p className="ltr:text-sm rtl:text-base text-muted-foreground">
          <Trans>Verbal noun forms (masadir) of the verb.</Trans>
        </p>

        <Accordion type="single" collapsible>
          {masadirFields.map((field, index) => {
            return (
              <AccordionItem key={field.id} value={field.id}>
                <AccordionTrigger>
                  <Trans>Masdar {index + 1}</Trans>
                </AccordionTrigger>

                <AccordionContent className="flex flex-col gap-y-2">
                  <FormField
                    control={form.control}
                    name={`morphology.verb.masadir.${index}.word` as const}
                    render={({ field: renderField }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Word</Trans>*
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="text"
                            dir="rtl"
                            // Need to do this otherwise the focus border will get cut off
                            // in the dropdown
                            className="w-[98%] ltr:ml-1 rtl:mr-1"
                            {...renderField}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`morphology.verb.masadir.${index}.details` as const}
                    render={({ field: renderField }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Details</Trans>
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="text"
                            dir="ltr"
                            // Need to do this otherwise the focus border will get cut off
                            // in the dropdown
                            className="w-[98%] ltr:ml-1 rtl:mr-1"
                            {...renderField}
                          />
                        </FormControl>

                        <FormDescription>
                          <Trans>
                            Any additional details about this form such as
                            frequency of usage or context.
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
                    onClick={() => removeMasdar(index)}
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
            appendMasdar({ word: "" });
          }}
          variant="outline"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          <Trans>Add Masdar</Trans>
        </Button>

        <FormField
          control={form.control}
          name="morphology.verb.form"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Verb form</Trans>
              </FormLabel>

              <FormControl>
                <Input type="text" dir="ltr" className="w-full" {...field} />
              </FormControl>

              <FormDescription>
                <Trans>The form of the verb ex. I, II, III, IV, etc...</Trans>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="morphology.verb.form_arabic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Arabic verb form</Trans>
              </FormLabel>

              <FormControl>
                <Input
                  type="text"
                  dir="rtl"
                  className="w-full text-xl"
                  {...field}
                />
              </FormControl>

              <FormDescription>
                <Trans>
                  The form of the verb in Arabic ex. فعل, أفعل, استفعل, etc...
                </Trans>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <h3 className="font-medium">
          <Trans>Huroof</Trans>
        </h3>

        <p className="ltr:text-sm rtl:text-base text-muted-foreground">
          <Trans>
            Prepositions (huroof) that can be used with the verb to change its
            meaning.
          </Trans>
        </p>

        <Accordion type="single" collapsible>
          {huroofFields.map((field, index) => {
            return (
              <AccordionItem key={field.id} value={field.id}>
                <AccordionTrigger>
                  <Trans>Harf {index + 1}</Trans>
                </AccordionTrigger>

                <AccordionContent className="flex flex-col gap-y-2">
                  <FormField
                    control={form.control}
                    name={`morphology.verb.huroof.${index}.harf` as const}
                    render={({ field: renderField }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Harf</Trans>*
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="text"
                            dir="rtl"
                            // Need to do this otherwise the focus border will get cut off
                            // in the dropdown
                            className="w-[98%] ltr:ml-1 rtl:mr-1"
                            {...renderField}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`morphology.verb.huroof.${index}.meaning` as const}
                    render={({ field: renderField }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Meaning</Trans>
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="text"
                            dir="ltr"
                            // Need to do this otherwise the focus border will get cut off
                            // in the dropdown
                            className="w-[98%] ltr:ml-1 rtl:mr-1"
                            {...renderField}
                          />
                        </FormControl>

                        <FormDescription>
                          <Trans>
                            The meaning of the verb when used with the harf.
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
                    onClick={() => removeHarf(index)}
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
            appendHarf({ harf: "" });
          }}
          variant="outline"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          <Trans>Add harf</Trans>
        </Button>
      </div>
    </CardContent>
  );
};
