import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useLocales } from "expo-localization";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { FormSchema } from "@/lib/schemas/dictionary";
import { addToSearchIndex } from "@/lib/search";
import { recentTagsAtom, store } from "@/lib/store";
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
  const insets = useSafeAreaInsets();

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

      try {
        await flashcardsTable.createForEntry.mutation({
          dictionary_entry_id: newEntry.id,
        });
      } catch (error) {
        console.warn("Failed to create flashcards:", error);
      }

      await queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });

      if (newEntry.tags && newEntry.tags.length > 0) {
        store.set(recentTagsAtom, newEntry.tags);
      }

      toast.success(t`Word added successfully`);
      router.back();
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
      entry: {
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
  };

  return (
    <FormProvider {...methods}>
      <KeyboardAwareScrollView
        bottomOffset={20}
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
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
