import { cn } from "@bahar/design-system";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@bahar/web-ui/components/breadcrumb";
import { Button } from "@bahar/web-ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bahar/web-ui/components/dialog";
import { Form } from "@bahar/web-ui/components/form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { type FC, useEffect } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AdditionalDetailsFormSection,
  BasicDetailsFormSection,
  CategoryFormSection,
  MorphologyFormSection,
} from "@/components/features/dictionary/add";
import { TagsFormSection } from "@/components/features/dictionary/add/TagsFormSection";
import { Page } from "@/components/Page";
import { useDeleteDictionaryEntry, useEditDictionaryEntry } from "@/hooks/db";
import { useDir } from "@/hooks/useDir";
import { useUserPlan } from "@/hooks/useUserPlan";
import { api } from "@/lib/api";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { queryClient } from "@/lib/query";
import { FormSchema } from "@/lib/schemas/dictionary";
import type { z } from "@/lib/zod";

const ResetFlashcardButton: FC<{ id: string }> = ({ id }) => {
  const { mutateAsync: resetFlashcard } = useMutation({
    mutationFn: async ({
      dictionary_entry_id,
    }: {
      dictionary_entry_id: string;
    }) => {
      await Promise.all([
        flashcardsTable.reset.mutation({
          dictionary_entry_id,
          direction: "forward",
        }),
        flashcardsTable.reset.mutation({
          dictionary_entry_id,
          direction: "reverse",
        }),
      ]);
    },
  });

  const { t } = useLingui();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="destructive">
          <Trans>Reset flashcard</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Reset flashcard progress?</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Are you sure you want to reset this flashcard's progress? The word
              entry in the dictionary will not be modified, but its
              corresponding flashcards will be treated as new ones.
              <br />
              <br />
              <strong>This action cannot be undone.</strong>
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              className="w-max self-center md:self-start"
              onClick={async () => {
                await resetFlashcard({ dictionary_entry_id: id });

                toast.success(t`Successfully reset the flashcard.`);
              }}
              type="button"
              variant="destructive"
            >
              <Trans>Reset flashcard</Trans>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteWordButton: FC<{ id: string }> = ({ id }) => {
  const { deleteDictionaryEntry } = useDeleteDictionaryEntry();

  const navigate = useNavigate();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="destructive">
          <Trans>Delete</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Delete this word?</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Are you sure you want to delete this word? It will be removed from
              your dictionary and its flashcards will be deleted.
              <br />
              <br />
              <strong>This action cannot be undone.</strong>
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            className="w-max self-center md:self-start"
            onClick={async () => {
              await deleteDictionaryEntry({ id });

              navigate({ to: "/" });
            }}
            type="button"
            variant="destructive"
          >
            <Trans>Delete</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Breadcrumbs: FC<{ className?: string; word: string }> = ({
  className,
  word,
}) => {
  return (
    <Breadcrumb className={cn("mb-8", className)}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">
              <Trans>Home</Trans>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbPage>
            <Trans>Edit {word}</Trans>
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

const BackButton = () => {
  const dir = useDir();
  const router = useRouter();

  return (
    <Button
      className="h-7 w-7"
      onClick={() => {
        router.history.back();
      }}
      size="icon"
      type="button"
      variant="outline"
    >
      {dir === "rtl" ? (
        <ChevronRight className="h-4 w-4" />
      ) : (
        <ChevronLeft className="h-4 w-4" />
      )}
      <span className="sr-only">
        <Trans>Back</Trans>
      </span>
    </Button>
  );
};

const getDefaultFormValues = (
  data?: Awaited<ReturnType<typeof dictionaryEntriesTable.entry.query>>
): z.infer<typeof FormSchema> => {
  const defaultMorphology = {
    ism: {
      singular: "",
      dual: "",
      gender: "masculine" as const,
      plurals: [],
      inflection: "triptote" as const,
    },
    verb: {
      huroof: [],
      past_tense: "",
      present_tense: "",
      active_participle: "",
      passive_participle: "",
      imperative: "",
      masadir: [],
      form: "",
      form_arabic: "",
    },
  };

  return {
    word: data?.word ?? "",
    translation: data?.translation ?? "",
    tags: data?.tags?.map((tag) => ({ name: tag })) ?? [],
    root: data?.root ? data.root.join(" ") : "",
    type: data?.type ?? "ism",
    examples: data?.examples ?? [],
    definition: data?.definition ?? "",
    antonyms:
      data?.antonyms?.map((antonym) => ({ word: antonym.word ?? "" })) ?? [],
    morphology: data?.morphology ?? defaultMorphology,
  };
};

const Edit = () => {
  const { editDictionaryEntry } = useEditDictionaryEntry();
  const { wordId } = Route.useParams();
  const { isProUser } = useUserPlan();

  const { data } = useQuery({
    queryFn: () => dictionaryEntriesTable.entry.query(wordId),
    queryKey: [...dictionaryEntriesTable.entry.cacheOptions.queryKey, wordId],
  });

  const { t } = useLingui();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: getDefaultFormValues(data),
  });

  // Scroll position is restored when navigating from
  // the home page after scrolling down
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const onSubmit: SubmitHandler<z.infer<typeof FormSchema>> = async (data) => {
    try {
      const root = data?.root
        ?.trim()
        ?.replace(/[\s,]+/g, "")
        ?.split("");

      const tags = data?.tags?.map((tag) => tag.name) ?? [];

      const id = wordId;

      const input = (() => {
        if (data.type === "ism") {
          return {
            ...data,
            id,
            root,
            tags,
            morphology: { ism: data?.morphology?.ism },
          };
        }
        if (data.type === "fi'l") {
          return {
            ...data,
            id,
            root,
            tags,
            morphology: { verb: data?.morphology?.verb },
          };
        }
        return {
          ...data,
          id,
          root,
          tags,
          morphology: undefined,
        };
      })();

      await editDictionaryEntry({ id: input.id, updates: input });

      toast.success(t`Successfully updated the word!`, {
        description: t`The word has been updated.`,
      });
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      }

      toast.error(t`Failed to update the word!`, {
        description: t`There was an error updating your word. Please try again.`,
      });
    }
  };

  const canAutofill =
    form.watch("word") && form.watch("translation") && form.watch("type");

  const autofill = useMutation({
    mutationFn: async () => {
      const type = form.getValues("type");
      if (!type) throw new Error("Type is required");

      const { data, error } = await api.ai.autocomplete.post({
        word: form.getValues("word"),
        translation: form.getValues("translation"),
        type,
      });
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
        toast.error(t`Autofill failed`, {
          description: t`Something went wrong. Please try again.`,
        });
      }
    },
    onSuccess: (data) => {
      if (!data) return;

      if (data.definition) {
        form.setValue("definition", data.definition);
      }
      if (data.root && data.root.length > 0) {
        form.setValue("root", data.root.join(" "));
      }

      if ("morphology" in data && data.morphology) {
        const type = form.getValues("type");
        const m = data.morphology as Record<string, unknown>;

        if (type === "ism") {
          const ism = m as {
            singular?: string;
            dual?: string;
            plurals?: { word: string; details?: string }[];
            gender?: "masculine" | "feminine";
            inflection?: "indeclinable" | "diptote" | "triptote";
          };
          if (ism.singular)
            form.setValue("morphology.ism.singular", ism.singular);
          if (ism.dual) form.setValue("morphology.ism.dual", ism.dual);
          if (ism.plurals?.length)
            form.setValue("morphology.ism.plurals", ism.plurals);
          if (ism.gender) form.setValue("morphology.ism.gender", ism.gender);
          if (ism.inflection)
            form.setValue("morphology.ism.inflection", ism.inflection);
        }

        if (type === "fi'l") {
          const verb = m as {
            past_tense?: string;
            present_tense?: string;
            active_participle?: string;
            passive_participle?: string;
            imperative?: string;
            masadir?: { word: string; details?: string }[];
            form?: string;
            form_arabic?: string;
            huroof?: { harf: string; meaning?: string }[];
          };
          if (verb.past_tense)
            form.setValue("morphology.verb.past_tense", verb.past_tense);
          if (verb.present_tense)
            form.setValue("morphology.verb.present_tense", verb.present_tense);
          if (verb.active_participle)
            form.setValue(
              "morphology.verb.active_participle",
              verb.active_participle
            );
          if (verb.passive_participle)
            form.setValue(
              "morphology.verb.passive_participle",
              verb.passive_participle
            );
          if (verb.imperative)
            form.setValue("morphology.verb.imperative", verb.imperative);
          if (verb.masadir?.length)
            form.setValue("morphology.verb.masadir", verb.masadir);
          if (verb.form) form.setValue("morphology.verb.form", verb.form);
          if (verb.form_arabic)
            form.setValue("morphology.verb.form_arabic", verb.form_arabic);
          if (verb.huroof?.length)
            form.setValue("morphology.verb.huroof", verb.huroof);
        }
      }
    },
  });

  const content = data!.word;

  return (
    <Page>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Breadcrumbs word={content} />

          <div className="mx-auto grid max-w-[59rem] flex-1 auto-rows-max gap-4">
            <div className="flex items-center gap-4">
              <BackButton />

              <h1 className="flex-1 shrink-0 whitespace-nowrap font-semibold text-xl tracking-tight sm:grow-0">
                {content}
              </h1>

              <div className="hidden items-center gap-2 md:ml-auto md:flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        className="relative overflow-hidden"
                        disabled={
                          !isProUser || !canAutofill || autofill.isPending
                        }
                        onClick={() => autofill.mutate()}
                        size="sm"
                        type="button"
                      >
                        {autofill.isPending && (
                          <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        )}
                        <Sparkles
                          className={cn(
                            "h-4 w-4",
                            autofill.isPending && "animate-pulse"
                          )}
                        />
                        {autofill.isPending ? (
                          <Trans>Generating...</Trans>
                        ) : (
                          <Trans>Autofill</Trans>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>

                  {!isProUser ? (
                    <TooltipContent>
                      <Trans>Upgrade to Pro to use AI autofill.</Trans>
                    </TooltipContent>
                  ) : (
                    !canAutofill && (
                      <TooltipContent>
                        <Trans>
                          Fill in the word, translation, and type first.
                        </Trans>
                      </TooltipContent>
                    )
                  )}
                </Tooltip>

                <DeleteWordButton id={data!.id} />

                <Button size="sm" type="submit">
                  <Trans>Save</Trans>
                </Button>
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex md:hidden">
                  <Button
                    className="relative overflow-hidden"
                    disabled={!isProUser || !canAutofill || autofill.isPending}
                    onClick={() => autofill.mutate()}
                    size="sm"
                    type="button"
                  >
                    {autofill.isPending && (
                      <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    )}
                    <Sparkles
                      className={cn(
                        "h-4 w-4",
                        autofill.isPending && "animate-pulse"
                      )}
                    />
                    {autofill.isPending ? (
                      <Trans>Generating...</Trans>
                    ) : (
                      <Trans>Autofill</Trans>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>

              {!isProUser ? (
                <TooltipContent>
                  <Trans>Upgrade to Pro to use AI autofill.</Trans>
                </TooltipContent>
              ) : (
                !canAutofill && (
                  <TooltipContent>
                    <Trans>
                      Fill in the word, translation, and type first.
                    </Trans>
                  </TooltipContent>
                )
              )}
            </Tooltip>

            <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
              <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
                <BasicDetailsFormSection />
                <AdditionalDetailsFormSection />
                <MorphologyFormSection />
              </div>

              <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
                <CategoryFormSection />

                <TagsFormSection />

                <div className="hidden sm:block">
                  <ResetFlashcardButton id={data!.id} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 md:hidden">
              <ResetFlashcardButton id={data!.id} />

              <DeleteWordButton id={data!.id} />

              <Button size="sm">
                <Trans>Save</Trans>
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </Page>
  );
};

export const Route = createFileRoute(
  "/_authorized-layout/_app-layout/dictionary/edit/$wordId"
)({
  component: Edit,
  beforeLoad: async ({ params }) => {
    const wordId = params.wordId;

    await queryClient.fetchQuery({
      queryKey: [...dictionaryEntriesTable.entry.cacheOptions.queryKey, wordId],
      queryFn: () => dictionaryEntriesTable.entry.query(wordId),
    });
  },
});
