import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { useAtom } from "jotai";
import { ChevronLeft, ChevronRight, Info } from "lucide-react-native";
import { useRef, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { toast } from "sonner-native";
import { z } from "zod";
import {
  AntonymsSection,
  AutofillButton,
  BasicDetailsSection,
  CollapsibleCard,
  ExamplesSection,
  IsmMorphologySection,
  TagsInput,
  VerbMorphologySection,
} from "@/components/dictionary/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCollapsibleHeader } from "@/hooks/useCollapsibleHeader";
import { useSearch } from "@/hooks/useSearch";
import {
  dictionaryEntriesTable,
  flashcardsTable,
  settingsTable,
} from "@/lib/db/operations";
import { FormSchema } from "@/lib/schemas/dictionary";
import { addToSearchIndex } from "@/lib/search";
import { createMultipleAtom, recentTagsAtom, store } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";
import { errorMap } from "@/utils/zod";

z.config({ customError: errorMap });

type FormData = z.infer<typeof FormSchema>;

const Breadcrumbs = () => {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2">
        <Pressable onPress={() => router.back()}>
          <Text className="text-muted-foreground text-sm">
            <Trans>Home</Trans>
          </Text>
        </Pressable>
        <ChevronRight color={colors.mutedForeground} size={14} />
        <Text className="font-normal text-foreground text-sm">
          <Trans>Add word</Trans>
        </Text>
      </View>
    </View>
  );
};

const BackButton = () => {
  const router = useRouter();
  const locales = useLocales();
  const dir = locales[0].textDirection;
  const BackIcon = dir === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <Button
      Icon={BackIcon}
      onPress={() => router.back()}
      size="icon"
      variant="outline"
    />
  );
};

export default function AddWordScreen() {
  const router = useRouter();
  const { scrollHandler } = useCollapsibleHeader(t`Add a new word`);
  const { reset } = useSearch();
  const [createMultiple, setCreateMultiple] = useAtom(createMultipleAtom);
  const colors = useThemeColors();
  const shouldResetFormRef = useRef(false);

  const { data: settingsData } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });
  // Per-word reverse choice for this new entry. Null = follow the account
  // default; flipping the switch overrides it for this word.
  const [createReverseOverride, setCreateReverseOverride] = useState<
    boolean | null
  >(null);
  const createReverse =
    createReverseOverride ?? settingsData?.create_reverse_by_default ?? false;

  const addWordMutation = useMutation({
    mutationFn: dictionaryEntriesTable.addWord.mutation,
    onSuccess: async (newEntry) => {
      await addToSearchIndex({
        id: newEntry.id,
        word: newEntry.word,
        translation: newEntry.translation,
        definition: newEntry.definition ?? undefined,
        type: newEntry.type ?? undefined,
        root: newEntry.root ?? undefined,
        tags: newEntry.tags ?? undefined,
      });
      reset();

      try {
        await flashcardsTable.createFlashcardPair.mutation({
          dictionary_entry_id: newEntry.id,
          createReverse,
        });
      } catch (error) {
        console.warn("Failed to create flashcards:", error);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: flashcardsTable.today.cacheOptions.queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: flashcardsTable.counts.cacheOptions.queryKey,
        }),
      ]);

      if (newEntry.tags && newEntry.tags.length > 0) {
        store.set(recentTagsAtom, newEntry.tags);
      }

      toast.success(t`Word added successfully`);

      if (createMultiple) {
        shouldResetFormRef.current = true;
      } else {
        router.back();
      }
    },
    onError: (error) => {
      toast.error(t`Failed to add word`);
      console.error("Add word error:", error);
    },
  });

  const methods = useForm<FormData>({
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

  const {
    handleSubmit,
    watch,
    control,
    formState: { isSubmitting },
  } = methods;

  const wordType = watch("type");
  const showAntonyms =
    wordType === "ism" || wordType === "fi'l" || wordType === "harf";
  const showMorphology = wordType === "ism" || wordType === "fi'l";

  const onSubmit = async (data: FormData) => {
    await addWordMutation.mutateAsync({
      word: {
        word: data.word,
        translation: data.translation,
        definition: data.definition || undefined,
        type: data.type ?? "ism",
        tags: data.tags?.length ? data.tags.map((t) => t.name) : undefined,
        root: data.root
          ? data.root
              .trim()
              .replace(/[\s,]+/g, "")
              .split("")
          : undefined,
        antonyms: data.antonyms?.length ? data.antonyms : undefined,
        examples: data.examples?.length ? data.examples : undefined,
        morphology: data.morphology,
      },
    });

    if (shouldResetFormRef.current) {
      shouldResetFormRef.current = false;
      methods.reset();
    }
  };

  return (
    <FormProvider {...methods}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        className="flex-1 bg-background"
        contentContainerClassName="pb-safe-offset-6"
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View className="flex-1 px-4 pt-4">
          <Breadcrumbs />

          <View className="gap-y-4">
            <View className="flex-row items-center gap-4">
              <BackButton />
              <Text className="flex-1 font-semibold text-foreground text-xl tracking-tight">
                <Trans>Add a new word</Trans>
              </Text>
            </View>

            <AutofillButton />

            <BasicDetailsSection />

            {showMorphology && wordType === "ism" && <IsmMorphologySection />}

            {showMorphology && wordType === "fi'l" && <VerbMorphologySection />}

            <ExamplesSection />

            {showAntonyms && <AntonymsSection />}

            <CollapsibleCard title={t`Tags`}>
              <Controller
                control={control}
                name="tags"
                render={({ field: { onChange, value } }) => (
                  <TagsInput onChange={onChange} value={value} />
                )}
              />
            </CollapsibleCard>

            <CollapsibleCard title={t`Flashcards`}>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 gap-0.5">
                  <Text className="font-medium text-foreground text-sm">
                    <Trans>Create a reverse card</Trans>
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    <Trans>English to Arabic, for this word.</Trans>
                  </Text>
                </View>

                <SegmentedControl
                  onValueChange={(v) => setCreateReverseOverride(v === "on")}
                  options={[
                    { value: "off", label: t`Off` },
                    { value: "on", label: t`On` },
                  ]}
                  value={createReverse ? "on" : "off"}
                />
              </View>
            </CollapsibleCard>

            <View className="flex-row items-center gap-2 self-center pt-2">
              <Pressable
                className="flex-row items-center gap-2"
                onPress={() => setCreateMultiple(!createMultiple)}
              >
                <Checkbox
                  checked={createMultiple}
                  onCheckedChange={setCreateMultiple}
                />
                <Text className="text-muted-foreground text-sm">
                  <Trans>Create multiple</Trans>
                </Text>
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert(
                    t`Create multiple`,
                    t`Keep adding words after saving instead of going back to the homepage.`
                  )
                }
              >
                <Info color={colors.mutedForeground} size={14} />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-center gap-3 pt-2">
              <Button onPress={() => router.back()} variant="outline">
                <Trans>Cancel</Trans>
              </Button>
              <Button
                disabled={isSubmitting || addWordMutation.isPending}
                onPress={() => handleSubmit(onSubmit)()}
                variant="default"
              >
                {addWordMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Trans>Save</Trans>
                )}
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </FormProvider>
  );
}
