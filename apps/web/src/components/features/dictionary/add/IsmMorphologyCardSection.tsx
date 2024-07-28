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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "@/lib/zod";
import {
  FormSchema,
  Inflection,
} from "@/routes/_app-layout/dictionary/add/route.lazy";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { Plus, InfoIcon } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

export const IsmMorphologyCardSection = () => {
  const { _ } = useLingui();
  const form = useFormContext<z.infer<typeof FormSchema>>();

  const {
    fields: pluralsFields,
    append: appendPlural,
    remove: removePlural,
  } = useFieldArray({
    name: "morphology.ism.plurals",
    control: form.control,
  });

  return (
    <CardContent>
      <div className="grid gap-3">
        <FormField
          control={form.control}
          name="morphology.ism.singular"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Singular</Trans>
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
          name="morphology.ism.dual"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Dual</Trans>
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
          <Trans>Plurals</Trans>
        </h3>

        <p className="ltr:text-sm rtl:text-base text-muted-foreground">
          <Trans>Any plural forms of the word.</Trans>
        </p>

        <Accordion type="single" collapsible>
          {pluralsFields.map((field, index) => {
            return (
              <AccordionItem key={field.id} value={field.id}>
                <AccordionTrigger>
                  <Trans>Plural {index + 1}</Trans>
                </AccordionTrigger>

                <AccordionContent className="flex flex-col gap-y-2">
                  <FormField
                    control={form.control}
                    name={`morphology.ism.plurals.${index}.word` as const}
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
                    name={`morphology.ism.plurals.${index}.details` as const}
                    render={({ field: renderField }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Details</Trans>
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="text"
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
                    onClick={() => removePlural(index)}
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
            appendPlural({ word: "" });
          }}
          variant="outline"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          <Trans>Add plural</Trans>
        </Button>

        <div className="grid gap-6 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="morphology.ism.gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Gender</Trans>
                </FormLabel>

                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger
                      id="gender"
                      aria-label={_(msg`Select gender`)}
                    >
                      <SelectValue placeholder={_(msg`Select gender`)} />
                    </SelectTrigger>
                  </FormControl>

                  <SelectContent>
                    <SelectItem value="masculine">
                      <Trans>Masculine</Trans>
                    </SelectItem>
                    <SelectItem value="feminine">
                      <Trans>Feminine</Trans>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="morphology.ism.inflection"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-x-2 items-center">
                  <FormLabel>
                    <Trans>Inflection</Trans>
                  </FormLabel>

                  <Popover>
                    <PopoverTrigger>
                      <InfoIcon className="h-4 w-4" />
                    </PopoverTrigger>

                    <PopoverContent className="text-sm" side="right">
                      <p>
                        <Trans>
                          This refers to how many case endings the word can
                          take.
                        </Trans>
                      </p>
                      <br />
                      <p>
                        <Trans>For example, the word</Trans>
                      </p>

                      <ul className="list-disc ltr:ml-4 rtl:mr-4">
                        <li>
                          <Trans>محمد is a triptote;</Trans>
                        </li>
                        <li>
                          <Trans>يوسف is a diptote;</Trans>
                        </li>
                        <li>
                          <Trans>موسى is indeclinable.</Trans>
                        </li>
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>

                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value as any} // Need to use integer value here
                >
                  <FormControl>
                    <SelectTrigger
                      id="gender"
                      aria-label={_(msg`Select inflection`)}
                    >
                      <SelectValue placeholder={_(msg`Select inflection`)} />
                    </SelectTrigger>
                  </FormControl>

                  <SelectContent>
                    <SelectItem value={String(Inflection.triptote)}>
                      <Trans>Triptote</Trans>
                    </SelectItem>
                    <SelectItem value={String(Inflection.diptote)}>
                      <Trans>Diptote</Trans>
                    </SelectItem>
                    <SelectItem value={String(Inflection.indeclinable)}>
                      <Trans>Indeclinable</Trans>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </CardContent>
  );
};
