import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { useToast } from "@/hooks/useToast";
import { decksTable } from "@/lib/db/operations/decks";
import { queryClient } from "@/lib/query";
import { z } from "@/lib/zod";
import { Autocomplete } from "../../Autocomplete";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../ui/form";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

const DeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  filters: z
    .object({
      tags: z.array(z.string()).optional(),
      state: z
        .array(
          z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
        )
        .optional(),
      types: z.array(z.enum(["ism", "fi'l", "harf", "expression"])).optional(),
    })
    .nullable(),
  total_hits: z.number(),
  to_review: z.number(),
});

const DeckFormSchema = z.object({
  name: z.string().min(1),
  tags: z.array(z.object({ word: z.string() })).optional(),
  types: z.array(z.enum(["ism", "fi'l", "harf", "expression"])).optional(),
});

type Types = "ism" | "fi'l" | "harf" | "expression";

const getTypeLabel = (type: Types) => {
  switch (type) {
    case "ism":
      return t`Ism`;
    case "fi'l":
      return t`Fi'l`;
    case "harf":
      return t`Harf`;
    case "expression":
      return t`Expression`;
  }
};

const NewDeckDialogHeader = () => {
  return (
    <>
      <DialogTitle>
        <Trans>Create a new deck</Trans>
      </DialogTitle>

      <DialogDescription>
        <Trans>
          Create a new deck by choosing filters. The deck will be composed of
          the cards that match the filters.
        </Trans>
      </DialogDescription>
    </>
  );
};

const EditDeckDialogHeader = () => {
  return (
    <>
      <DialogTitle>
        <Trans>Edit your deck</Trans>
      </DialogTitle>

      <DialogDescription>
        <Trans>
          Edit your deck by choosing filters. The deck will be composed of the
          cards that match the filters.
        </Trans>
      </DialogDescription>
    </>
  );
};

export const DeckDialogContent = ({
  deck,
}: {
  deck?: z.infer<typeof DeckSchema>;
}) => {
  const allTypes: Types[] = ["ism", "fi'l", "harf", "expression"];

  const { mutateAsync: createDeck } = useMutation({
    mutationFn: decksTable.create.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
    },
  });

  const { mutateAsync: updateDeck } = useMutation({
    mutationFn: decksTable.update.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
    },
  });

  const { toast } = useToast();
  const { t } = useLingui();
  const form = useForm<z.infer<typeof DeckFormSchema>>({
    resolver: zodResolver(DeckFormSchema),
    values: {
      name: deck?.name ?? "",
      tags: deck?.filters?.tags?.map((tag) => ({ word: tag })) ?? [],
      types: deck?.filters?.types ?? allTypes,
    },
  });

  const {
    fields: tagFields,
    append: appendTag,
    remove: removeTag,
  } = useFieldArray({
    name: "tags",
    control: form.control,
  });

  const isEditing = !!deck;

  const onSubmit = async (values: z.infer<typeof DeckFormSchema>) => {
    const { name, tags, types } = values;
    const filters = { tags: tags?.map((tag) => tag.word), types };

    try {
      if (isEditing) {
        await updateDeck({
          id: deck.id,
          updates: { name, filters },
        });

        toast({
          title: t`Deck successfully updated!`,
        });
      } else {
        await createDeck({ deck: { name, filters } });

        toast({
          title: t`Deck successfully created!`,
        });
      }

      if (!isEditing) {
        form.reset();
      }
    } catch (err) {
      if (isEditing) {
        toast({
          title: t`There was an error updating the deck`,
          description: t`Your deck was not updated. Please try again.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: t`There was an error creating the deck`,
          description: t`Your deck was not created. Please try again.`,
          variant: "destructive",
        });
      }
    }
  };

  return (
    <DialogContent className="max-h-[600px] overflow-auto sm:max-w-[425px]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            {deck ? <EditDeckDialogHeader /> : <NewDeckDialogHeader />}
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-2">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <FormLabel>
                      <Trans>Name</Trans>
                    </FormLabel>

                    <FormControl>
                      <Input
                        className="col-span-3"
                        data-1p-ignore
                        placeholder={t`Enter a deck name`}
                        {...field}
                      />
                    </FormControl>
                  </div>

                  <FormDescription>
                    <Trans>This is the name of your deck.</Trans>
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="mb-2 flex flex-col gap-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ltr:text-sm rtl:text-base">
                <Trans>Tags</Trans>
              </Label>

              <Autocomplete
                allowAdd={false}
                className="col-span-3"
                filter={tagFields.map((field) => field.word)}
                onClick={(val) => {
                  appendTag({ word: val });
                }}
              />
            </div>

            <p className="text-muted-foreground ltr:text-sm rtl:text-base">
              <Trans>
                Words that have any of these tags will be included in the deck.
              </Trans>
            </p>
          </div>

          <ul className="mb-3 flex flex-wrap gap-2">
            {tagFields.map((field, index) => {
              return (
                <Badge
                  className="cursor-pointer"
                  key={field.id}
                  onClick={() => removeTag(index)}
                  variant="secondary"
                >
                  <span className="mr-1">{field.word}</span>

                  <X className="h-4 w-4" />
                </Badge>
              );
            })}
          </ul>

          <FormField
            control={form.control}
            name="types"
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">
                    <Trans>Types</Trans>
                  </FormLabel>

                  <FormDescription>
                    <Trans>
                      Select the types of words that you want to include in the
                      deck.
                    </Trans>
                  </FormDescription>
                </div>

                <div className="flex flex-wrap gap-4">
                  {allTypes.map((type) => (
                    <FormField
                      control={form.control}
                      key={type}
                      name="types"
                      render={({ field }) => {
                        return (
                          <FormItem className="flex flex-row items-center gap-x-3 gap-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(type)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange(
                                        field.value
                                          ? [...field.value, type]
                                          : [type]
                                      )
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== type
                                        )
                                      );
                                }}
                              />
                            </FormControl>

                            <FormLabel className="!mt-0 cursor-pointer font-normal text-sm">
                              {getTypeLabel(type)}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>

                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button
              className="mt-4"
              disabled={form.formState.isSubmitting || !form.formState.isDirty}
              size="sm"
              type="submit"
            >
              <Trans>Save changes</Trans>
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};
