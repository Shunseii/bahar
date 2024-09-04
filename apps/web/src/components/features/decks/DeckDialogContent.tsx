import { Trans, msg } from "@lingui/macro";
import { Button } from "../../ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { z } from "@/lib/zod";
import { useFieldArray, useForm } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  Form,
} from "../../ui/form";
import { Badge } from "../../ui/badge";
import { X } from "lucide-react";
import { Autocomplete } from "../../Autocomplete";
import { Label } from "../../ui/label";
import { Checkbox } from "../../ui/checkbox";
import { t } from "@lingui/macro";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/useToast";
import { useLingui } from "@lingui/react";
import { queryClient } from "@/lib/query";
import { getQueryKey } from "@trpc/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { DeckSchema } from "api/schemas";

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

  const { mutateAsync: createDeck } = trpc.decks.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...getQueryKey(trpc.decks.list), { type: "query" }],
      });
    },
  });
  const { mutateAsync: updateDeck } = trpc.decks.update.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...getQueryKey(trpc.decks.list), { type: "query" }],
      });
    },
  });
  const { toast } = useToast();
  const { _ } = useLingui();
  const form = useForm<z.infer<typeof DeckFormSchema>>({
    resolver: zodResolver(DeckFormSchema),
    defaultValues: {
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

    try {
      if (isEditing) {
        await updateDeck({
          id: deck.id,
          name,
          filters: { tags: tags?.map((tag) => tag.word), types },
        });

        toast({
          title: _(msg`Deck successfully updated!`),
        });
      } else {
        await createDeck({
          name,
          filters: { tags: tags?.map((tag) => tag.word), types },
        });

        toast({
          title: _(msg`Deck successfully created!`),
        });
      }

      if (!isEditing) {
        form.reset();
      }
    } catch (err) {
      if (isEditing) {
        toast({
          title: _(msg`There was an error updating the deck`),
          description: _(msg`Your deck was not updated. Please try again.`),
          variant: "destructive",
        });
      } else {
        toast({
          title: _(msg`There was an error creating the deck`),
          description: _(msg`Your deck was not created. Please try again.`),
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
                        placeholder={_(msg`Enter a deck name`)}
                        {...field}
                      />
                    </FormControl>
                  </div>

                  <FormDescription>
                    This is the name of your deck.
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="ltr:text-sm rtl:text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                <Trans>Tags</Trans>
              </Label>

              <Autocomplete
                className="col-span-3"
                allowAdd={false}
                filter={tagFields.map((field) => field.word)}
                onClick={(val) => {
                  appendTag({ word: val });
                }}
              />
            </div>

            <p className="ltr:text-sm rtl:text-base text-muted-foreground">
              <Trans>
                Words that have any of these tags will be included in the deck.
              </Trans>
            </p>
          </div>

          <ul className="flex flex-wrap gap-2 mb-2">
            {tagFields.map((field, index) => {
              return (
                <Badge
                  key={field.id}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeTag(index)}
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
                      name="types"
                      key={type}
                      render={({ field }) => {
                        return (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(type)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange(
                                        field.value
                                          ? [...field.value, type]
                                          : [type],
                                      )
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== type,
                                        ),
                                      );
                                }}
                              />
                            </FormControl>

                            <FormLabel className="text-sm font-normal cursor-pointer">
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
              size="sm"
              className="mt-4"
              disabled={form.formState.isSubmitting || !form.formState.isDirty}
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
