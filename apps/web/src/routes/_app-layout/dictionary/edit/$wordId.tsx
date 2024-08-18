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
import { FormSchema, Inflection } from "../add/route.lazy";
import { useDir } from "@/hooks/useDir";
import { TagsFormSection } from "@/components/features/dictionary/add/TagsFormSection";

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
  const { mutateAsync: resetFlashcard } = trpc.flashcard.reset.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getQueryKey(trpc.flashcard.today, undefined, "query"),
      });
    },
  });
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

  const { mutateAsync: deleteWord } = trpc.dictionary.deleteWord.useMutation();
  const { wordId } = Route.useParams();
  const navigate = useNavigate();
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
      morphology: data?.morphology ?? {
        ism: {
          singular: "",
          dual: "",
          gender: "masculine",
          plurals: [],
          inflection: Inflection.triptote,
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
      const filteredData = (() => {
        if (data.type === "ism") {
          return {
            ...data,
            root: data?.root
              ?.trim()
              ?.replace(/[\s,]+/g, "")
              ?.split(""),
            morphology: { ism: data?.morphology?.ism },
            tags: data?.tags?.map((tag) => tag.name) ?? [],
          };
        } else if (data.type === "fi'l") {
          return {
            ...data,
            root: data?.root
              ?.trim()
              ?.replace(/[\s,]+/g, "")
              ?.split(""),
            morphology: { verb: data?.morphology?.verb },
            tags: data?.tags?.map((tag) => tag.name) ?? [],
          };
        } else {
          return {
            ...data,
            root: data?.root
              ?.trim()
              ?.replace(/[\s,]+/g, "")
              ?.split(""),
            morphology: undefined,
            tags: data?.tags?.map((tag) => tag.name) ?? [],
          };
        }
      })();

      await editWord({ id: wordId, ...filteredData });

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
                <Button
                  variant="destructive"
                  type="button"
                  size="sm"
                  onClick={async () => {
                    await deleteWord({ id: data?.id! });

                    refresh();

                    navigate({ to: "/" });
                  }}
                >
                  <Trans>Delete</Trans>
                </Button>

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

                <Button
                  variant="destructive"
                  type="button"
                  size="sm"
                  className="hidden sm:block"
                  onClick={async () => {
                    await resetFlashcard({ id: data?.id! });
                  }}
                >
                  <Trans>Reset flashcard</Trans>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 md:hidden">
              <Button
                variant="destructive"
                type="button"
                size="sm"
                onClick={async () => {
                  await editWord({ id: data?.id!, flashcard: null });
                }}
              >
                <Trans>Reset flashcard</Trans>
              </Button>

              <Button
                variant="destructive"
                type="button"
                size="sm"
                onClick={async () => {
                  await deleteWord({ id: data?.id! });

                  refresh();

                  navigate({ to: "/" });
                }}
              >
                <Trans>Delete</Trans>
              </Button>

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
