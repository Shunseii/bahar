import { Page } from "@/components/Page";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryClient } from "@/lib/query";
import { trpc, trpcClient } from "@/lib/trpc";
import { getQueryKey } from "@trpc/react-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Trans, msg } from "@lingui/macro";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { z } from "@/lib/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  AdditionalDetailsFormSection,
  BasicDetailsFormSection,
  MorphologyFormSection,
  CategoryFormSection,
} from "@/components/features/dictionary/add";
import { useToast } from "@/hooks/useToast";
import { useLingui } from "@lingui/react";
import { useInstantSearch } from "react-instantsearch";
import { FC } from "react";
import { useDir } from "@/hooks/useDir";
import { TagsFormSection } from "@/components/features/dictionary/add/TagsFormSection";
import { FormSchema, Inflection } from "@/schemas/dictionary";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ResetFlashcardButton: FC<{ id: string }> = ({ id }) => {
  const { mutateAsync: resetFlashcard } = trpc.flashcard.reset.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getQueryKey(trpc.flashcard.today, undefined, "query"),
      });
    },
  });
  const { toast } = useToast();
  const { _ } = useLingui();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" type="button" size="sm">
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
              variant="destructive"
              type="button"
              className="w-max md:self-start self-center"
              onClick={async () => {
                await resetFlashcard({ id });

                toast({
                  title: _(msg`Successfully reset the flashcard.`),
                });
              }}
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
  const { mutateAsync: deleteWord } = trpc.dictionary.deleteWord.useMutation();
  const navigate = useNavigate();
  const { refresh } = useInstantSearch();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" type="button" size="sm">
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
            variant="destructive"
            type="button"
            className="w-max md:self-start self-center"
            onClick={async () => {
              await deleteWord({ id });

              refresh();

              navigate({ to: "/" });
            }}
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

  return (
    <Button
      variant="outline"
      type="button"
      size="icon"
      className="h-7 w-7"
      asChild
    >
      <Link to="/">
        {dir === "rtl" ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        <span className="sr-only">
          <Trans>Back</Trans>
        </span>
      </Link>
    </Button>
  );
};

const Edit = () => {
  const { mutateAsync: editWord } = trpc.dictionary.editWord.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getQueryKey(
          trpc.dictionary.find,
          {
            id: wordId,
          },
          "query",
        ),
      });
    },
  });

  const { wordId } = Route.useParams();
  const { data } = trpc.dictionary.find.useQuery({ id: wordId });
  const { toast } = useToast();
  const { refresh } = useInstantSearch();
  const { _ } = useLingui();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      word: data?.word ?? "",
      translation: data?.translation ?? "",
      tags: data?.tags?.map((tag) => ({ name: tag })) ?? [],
      root: data?.root ? data.root.join(" ") : "",
      type: data?.type ?? "ism",
      examples: data?.examples ?? [],
      definition: data?.definition ?? "",
      antonyms: data?.antonyms ?? [],
      morphology: data?.morphology ?? {
        ism: {
          singular: "",
          dual: "",
          gender: "masculine",
          plurals: [],
          inflection: "triptote",
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
      },
    },
  });

  const onSubmit: SubmitHandler<z.infer<typeof FormSchema>> = async (data) => {
    try {
      const root = data?.root
        ?.trim()
        ?.replace(/[\s,]+/g, "")
        ?.split("");

      const tags = data?.tags?.map((tag) => tag.name) ?? [];

      const id = wordId;

      if (data.type === "ism") {
        await editWord({
          ...data,
          id,
          root,
          tags,
          morphology: { ism: data?.morphology?.ism },
        });
      } else if (data.type === "fi'l") {
        await editWord({
          ...data,
          id,
          root,
          tags,
          morphology: { verb: data?.morphology?.verb },
        });
      } else {
        await editWord({
          ...data,
          id,
          root,
          tags,
          morphology: undefined,
        });
      }

      toast({
        title: _(msg`Successfully updated the word!`),
        description: _(msg`The word has been updated.`),
      });

      refresh();
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      }

      toast({
        title: _(msg`Failed to update the word!`),
        description: _(
          msg`There was an error updating your word. Please try again.`,
        ),
        variant: "destructive",
      });
    }
  };

  const content = data?.word!;

  return (
    <Page>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Breadcrumbs word={content} />

          <div className="mx-auto grid max-w-[59rem] flex-1 auto-rows-max gap-4">
            <div className="flex items-center gap-4">
              <BackButton />

              <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
                {content}
              </h1>

              <div className="hidden items-center gap-2 md:ml-auto md:flex">
                <DeleteWordButton id={data?.id!} />

                <Button size="sm" type="submit">
                  <Trans>Save</Trans>
                </Button>
              </div>
            </div>

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
                  <ResetFlashcardButton id={data?.id!} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 md:hidden">
              <ResetFlashcardButton id={data?.id!} />

              <DeleteWordButton id={data?.id!} />

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

export const Route = createFileRoute("/_app-layout/dictionary/edit/$wordId")({
  component: Edit,
  beforeLoad: async ({ params }) => {
    const wordId = params.wordId;

    // TODO: using ensureQueryData results in data being undefined
    // when accessed for the first time
    await queryClient.fetchQuery({
      queryKey: [
        ...getQueryKey(
          trpc.dictionary.find,
          {
            id: wordId,
          },
          "query",
        ),
      ],
      queryFn: () => trpcClient.dictionary.find.query({ id: wordId }),
    });
  },
});
