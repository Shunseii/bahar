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
import { Form } from "@bahar/web-ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
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
import { useAddDictionaryEntry } from "@/hooks/db";
import { useDir } from "@/hooks/useDir";
import { FormSchema } from "@/lib/schemas/dictionary";
import type { z } from "@/lib/zod";

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
      asChild
      className="h-7 w-7"
      size="icon"
      type="button"
      variant="outline"
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
  const { addDictionaryEntry } = useAddDictionaryEntry();

  const { t } = useLingui();
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

      const wordData = (() => {
        if (data.type === "ism") {
          return {
            ...data,
            root,
            tags,
            morphology: { ism: data?.morphology?.ism },
          };
        }
        if (data.type === "fi'l") {
          return {
            ...data,
            root,
            tags,
            morphology: { verb: data?.morphology?.verb },
          };
        }
        return {
          ...data,
          root,
          tags,
          morphology: undefined,
        };
      })();

      await addDictionaryEntry({
        word: { ...wordData, type: data.type ?? "ism" },
      });

      toast.success(t`Successfully added word!`, {
        description: t`The word has been added to your dictionary.`,
      });
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      }

      toast.error(t`Failed to add word!`, {
        description: t`There was an error adding your word. Please try again.`,
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

              <h1 className="flex-1 shrink-0 whitespace-normal font-semibold text-xl tracking-tight sm:grow-0 sm:whitespace-nowrap">
                <Trans>Add a new word to your dictionary</Trans>
              </h1>

              <div className="hidden items-center gap-2 md:ml-auto md:flex">
                <Button asChild size="sm" type="button" variant="outline">
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
              <Button asChild size="sm" type="button" variant="outline">
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

export const Route = createLazyFileRoute(
  "/_authorized-layout/_app-layout/dictionary/add"
)({
  component: Add,
});
