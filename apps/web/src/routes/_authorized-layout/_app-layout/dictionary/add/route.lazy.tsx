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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
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
  const { data: userData } = authClient.useSession();
  const isProUser =
    userData?.user.plan === "pro" &&
    userData.user.subscriptionStatus !== "canceled";

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

  return (
    <Page>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Breadcrumbs />

          <div className="mx-auto grid max-w-236 flex-1 auto-rows-max gap-4">
            <div className="flex items-center gap-4">
              <BackButton />

              <h1 className="flex-1 shrink-0 whitespace-normal font-semibold text-xl tracking-tight sm:grow-0 sm:whitespace-nowrap">
                <Trans>Add a new word to your dictionary</Trans>
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
                          <span className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/20 to-transparent" />
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
                      <span className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/20 to-transparent" />
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
