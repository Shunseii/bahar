import { Page } from "@/components/Page";
import { Link, createLazyFileRoute } from "@tanstack/react-router";
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
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/useToast";
import { useLingui } from "@lingui/react";
import { useInstantSearch } from "react-instantsearch";
import { useEffect } from "react";
import { useDir } from "@/hooks/useDir";
import { TagsFormSection } from "@/components/features/dictionary/add/TagsFormSection";
import { FormSchema } from "@/schemas/dictionary";

const Breadcrumbs = ({ className }: { className?: string }) => {
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
            <Trans>Add word</Trans>
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

const Add = () => {
  const { mutateAsync: addWord } = trpc.dictionary.addWord.useMutation();
  const { toast } = useToast();
  const { refresh } = useInstantSearch();
  const { _ } = useLingui();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      word: "",
      translation: "",
      tags: [],
      root: "",
      type: "ism",
      examples: [],
      definition: "",
      antonyms: [],
      morphology: {
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

      if (data.type === "ism") {
        await addWord({
          ...data,
          root,
          tags,
          morphology: { ism: data?.morphology?.ism },
        });
      } else if (data.type === "fi'l") {
        await addWord({
          ...data,
          root,
          tags,
          morphology: { verb: data?.morphology?.verb },
        });
      } else {
        await addWord({
          ...data,
          root,
          tags,
          morphology: undefined,
        });
      }

      toast({
        title: _(msg`Successfully added word!`),
        description: _(msg`The word has been added to your dictionary.`),
      });

      refresh();
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      }

      toast({
        title: _(msg`Failed to add word!`),
        description: _(
          msg`There was an error adding your word. Please try again.`,
        ),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      form.reset();
    }
  }, [form.formState, form.reset]);

  return (
    <Page>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Breadcrumbs />

          <div className="mx-auto grid max-w-[59rem] flex-1 auto-rows-max gap-4">
            <div className="flex items-center gap-4">
              <BackButton />

              <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
                <Trans>Add a new word to your dictionary</Trans>
              </h1>

              <div className="hidden items-center gap-2 md:ml-auto md:flex">
                <Button variant="outline" type="button" size="sm" asChild>
                  <Link to="/">
                    <Trans>Discard</Trans>
                  </Link>
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
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 md:hidden">
              <Button variant="outline" size="sm" type="button" asChild>
                <Link to="/">
                  <Trans>Discard</Trans>
                </Link>
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

export const Route = createLazyFileRoute("/_app-layout/dictionary/add")({
  component: Add,
});
