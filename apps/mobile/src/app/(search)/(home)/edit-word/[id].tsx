import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocales } from "expo-localization";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
} from "lucide-react-native";
import { useEffect } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
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
import { removeFromSearchIndex, updateSearchIndex } from "@/lib/search";
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
          <Trans>Edit word</Trans>
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

export default function EditWordScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const {
    data: entry,
    isLoading,
    error,
  } = useQuery({
    queryFn: () => dictionaryEntriesTable.entry.query({ id: id! }),
    queryKey: [...dictionaryEntriesTable.entry.cacheOptions.queryKey, id],
    enabled: !!id,
  });

  const editMutation = useMutation({
    mutationFn: dictionaryEntriesTable.editWord.mutation,
    onSuccess: async (updatedEntry) => {
      await updateSearchIndex(updatedEntry.id, {
        word: updatedEntry.word,
        translation: updatedEntry.translation,
        definition: updatedEntry.definition ?? undefined,
        type: updatedEntry.type ?? undefined,
        root: updatedEntry.root ?? undefined,
        tags: updatedEntry.tags ?? undefined,
      });

      await queryClient.invalidateQueries({
        queryKey: dictionaryEntriesTable.entry.cacheOptions.queryKey,
      });

      toast.success(t`Word updated successfully`);
      router.back();
    },
    onError: (error) => {
      toast.error(t`Failed to update word`);
      console.error("Edit error:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: dictionaryEntriesTable.delete.mutation,
    onSuccess: async (deletedEntry) => {
      await removeFromSearchIndex(deletedEntry.id);
      await queryClient.invalidateQueries({
        queryKey: dictionaryEntriesTable.entry.cacheOptions.queryKey,
      });
      toast.success(t`Word deleted successfully`);
      router.back();
    },
    onError: (error) => {
      toast.error(t`Failed to delete word`);
      console.error("Delete error:", error);
    },
  });

  const resetFlashcardMutation = useMutation({
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
      toast.success(t`Flashcard reset successfully`);
    },
    onError: (error) => {
      toast.error(t`Failed to reset flashcard`);
      console.error("Reset flashcard error:", error);
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
    formState: { isSubmitting, isDirty },
    reset,
  } = methods;

  const wordType = watch("type");

  useEffect(() => {
    if (entry) {
      reset({
        word: entry.word,
        translation: entry.translation,
        definition: entry.definition ?? "",
        type: entry.type ?? "ism",
        tags: entry.tags?.map((t) => ({ name: t })) ?? [],
        root: entry.root?.join(" ") ?? "",
        examples: entry.examples ?? [],
        antonyms: entry.antonyms ?? [],
        morphology: entry.morphology ?? {
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
      });
    }
  }, [entry, reset]);

  const onSubmit = async (data: FormData) => {
    if (!id) return;

    await editMutation.mutateAsync({
      id,
      updates: {
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

  const handleDelete = () => {
    Alert.alert(
      t`Delete word`,
      t`Are you sure you want to delete this word? This action cannot be undone.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: () => {
            if (id) {
              deleteMutation.mutate({ id });
            }
          },
        },
      ]
    );
  };

  const handleResetFlashcard = () => {
    if (!entry) return;
    Alert.alert(
      t`Reset flashcard`,
      t`Are you sure you want to reset the flashcard for this word? This will reset all spaced repetition progress.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Reset`,
          style: "destructive",
          onPress: () => {
            resetFlashcardMutation.mutate({
              dictionary_entry_id: entry.id,
            });
          },
        },
      ]
    );
  };

  const showAntonyms =
    wordType === "ism" || wordType === "fi'l" || wordType === "harf";
  const showMorphology = wordType === "ism" || wordType === "fi'l";

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !entry) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="mb-2 font-medium text-destructive text-lg">
          <Trans>Word not found</Trans>
        </Text>
        <Button onPress={() => router.back()} variant="outline">
          <Trans>Go back</Trans>
        </Button>
      </View>
    );
  }

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
                <Trans>Edit word</Trans>
              </Text>
              <View className="flex-row items-center gap-1">
                <Button
                  disabled={resetFlashcardMutation.isPending}
                  Icon={RotateCcw}
                  onPress={handleResetFlashcard}
                  size="icon"
                  variant="ghost"
                />
                <Button
                  disabled={deleteMutation.isPending}
                  onPress={handleDelete}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 color={colors.destructive} size={20} />
                </Button>
              </View>
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
                disabled={isSubmitting || editMutation.isPending || !isDirty}
                onPress={() => handleSubmit(onSubmit)()}
                variant="default"
              >
                {editMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Trans>Save changes</Trans>
                )}
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </FormProvider>
  );
}
