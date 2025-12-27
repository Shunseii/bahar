import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocales } from "expo-localization";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { FormSchema } from "@/lib/schemas/dictionary";
import { removeFromSearchIndex, updateSearchIndex } from "@/lib/search";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";
import { errorMap } from "@/utils/zod";

z.config({ customError: errorMap });

type FormData = z.infer<typeof FormSchema>;

const WORD_TYPES = [
  { value: "ism", label: "Ism (Noun)" },
  { value: "fi'l", label: "Fi'l (Verb)" },
  { value: "harf", label: "Harf (Particle)" },
  { value: "expression", label: "Expression" },
] as const;

const GENDERS = [
  { value: "masculine", label: "Masculine" },
  { value: "feminine", label: "Feminine" },
] as const;

const INFLECTIONS = [
  { value: "triptote", label: "Triptote" },
  { value: "diptote", label: "Diptote" },
  { value: "indeclinable", label: "Indeclinable" },
] as const;

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
  const colors = useThemeColors();
  const dir = locales[0].textDirection;

  return (
    <Button onPress={() => router.back()} size="icon" variant="outline">
      {dir === "rtl" ? (
        <ChevronRight color={colors.foreground} size={16} />
      ) : (
        <ChevronLeft color={colors.foreground} size={16} />
      )}
    </Button>
  );
};

const TagsInput = ({
  value,
  onChange,
}: {
  value: { name: string }[] | undefined;
  onChange: (value: { name: string }[]) => void;
}) => {
  const colors = useThemeColors();
  const [tagInput, setTagInput] = useState("");

  const handleSubmit = () => {
    const text = tagInput.trim();
    if (text) {
      onChange([...(value || []), { name: text }]);
      setTagInput("");
    }
  };

  return (
    <View className="gap-3">
      {value && value.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {value.map((tag, index) => (
            <View
              className="flex-row items-center rounded-full bg-primary/10 px-3 py-1.5"
              key={index}
            >
              <Text className="text-primary text-sm">{tag.name}</Text>
              <Pressable
                className="ml-1.5"
                onPress={() => {
                  const newTags = value.filter((_, i) => i !== index);
                  onChange(newTags);
                }}
              >
                <X color={colors.primary} size={14} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Input
        onChangeText={setTagInput}
        onSubmitEditing={handleSubmit}
        placeholder={t`Add a tag and press enter`}
        returnKeyType="done"
        value={tagInput}
      />
    </View>
  );
};

const SelectDropdown = ({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const colors = useThemeColors();

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-md border border-input bg-background px-3 py-2.5"
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? options.find((o) => o.value === value)?.label : placeholder}
        </Text>
        <ChevronDown color={colors.mutedForeground} size={16} />
      </Pressable>
      {isOpen && (
        <View className="mt-1 overflow-hidden rounded-md border border-input bg-background">
          {options.map((option) => (
            <Pressable
              className={`px-3 py-2.5 ${
                value === option.value ? "bg-primary/10" : ""
              } active:bg-muted`}
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <Text
                className={
                  value === option.value
                    ? "font-medium text-primary"
                    : "text-foreground"
                }
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

export default function EditWordScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  // Fetch the existing entry
  const {
    data: entry,
    isLoading,
    error,
  } = useQuery({
    queryFn: () => dictionaryEntriesTable.entry.query({ id: id! }),
    queryKey: [...dictionaryEntriesTable.entry.cacheOptions.queryKey, id],
    enabled: !!id,
  });

  // Edit mutation
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

  // Delete mutation
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

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<FormData>({
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

  const wordType = watch("type");

  const {
    fields: exampleFields,
    append: appendExample,
    remove: removeExample,
  } = useFieldArray({ control, name: "examples" });

  const {
    fields: antonymFields,
    append: appendAntonym,
    remove: removeAntonym,
  } = useFieldArray({ control, name: "antonyms" });

  const {
    fields: pluralFields,
    append: appendPlural,
    remove: removePlural,
  } = useFieldArray({ control, name: "morphology.ism.plurals" });

  const {
    fields: masadirFields,
    append: appendMasdar,
    remove: removeMasdar,
  } = useFieldArray({ control, name: "morphology.verb.masadir" });

  const {
    fields: huroofFields,
    append: appendHarf,
    remove: removeHarf,
  } = useFieldArray({ control, name: "morphology.verb.huroof" });

  // Populate form when entry is loaded
  useEffect(() => {
    if (entry) {
      reset({
        word: entry.word,
        translation: entry.translation,
        definition: entry.definition ?? "",
        type: entry.type ?? "ism",
        tags: entry.tags?.map((t) => ({ name: t })) ?? [],
        root: entry.root?.join("") ?? "",
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
        root: data.root ? data.root.split("") : undefined,
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

  const showRootField = wordType === "ism" || wordType === "fi'l";
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
    <ScrollView
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
            <Button
              disabled={deleteMutation.isPending}
              onPress={handleDelete}
              size="icon"
              variant="ghost"
            >
              <Trash2 color={colors.destructive} size={20} />
            </Button>
          </View>

          {/* Basic Details */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Basic Details</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="gap-5">
                <View className="gap-2">
                  <Text className="font-medium text-foreground text-sm">
                    <Trans>Word</Trans> *
                  </Text>
                  <Controller
                    control={control}
                    name="word"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder={t`Arabic word`}
                        style={{ textAlign: "right" }}
                        value={value}
                      />
                    )}
                  />
                  {errors.word && (
                    <Text className="text-destructive text-sm">
                      {errors.word.message}
                    </Text>
                  )}
                </View>

                <View className="gap-2">
                  <Text className="font-medium text-foreground text-sm">
                    <Trans>Translation</Trans> *
                  </Text>
                  <Controller
                    control={control}
                    name="translation"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder={t`English translation`}
                        value={value}
                      />
                    )}
                  />
                  {errors.translation && (
                    <Text className="text-destructive text-sm">
                      {errors.translation.message}
                    </Text>
                  )}
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Category</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="gap-2">
                <Text className="font-medium text-foreground text-sm">
                  <Trans>Type</Trans>
                </Text>
                <Controller
                  control={control}
                  name="type"
                  render={({ field: { onChange, value } }) => (
                    <SelectDropdown
                      onChange={onChange}
                      options={WORD_TYPES}
                      placeholder={t`Select type`}
                      value={value}
                    />
                  )}
                />
              </View>
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Additional Details</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="gap-5">
                <View className="gap-2">
                  <Text className="font-medium text-foreground text-sm">
                    <Trans>Definition</Trans>
                  </Text>
                  <Controller
                    control={control}
                    name="definition"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        multiline
                        numberOfLines={3}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder={t`Arabic definition`}
                        style={{ textAlign: "right" }}
                        value={value ?? ""}
                      />
                    )}
                  />
                </View>

                {showRootField && (
                  <View className="gap-2">
                    <Text className="font-medium text-foreground text-sm">
                      <Trans>Root Letters</Trans>
                    </Text>
                    <Controller
                      control={control}
                      name="root"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          onBlur={onBlur}
                          onChangeText={onChange}
                          placeholder={t`e.g. ك ت ب`}
                          style={{ textAlign: "right" }}
                          value={value ?? ""}
                        />
                      )}
                    />
                    <Text className="text-muted-foreground text-xs">
                      <Trans>Separate letters with spaces or commas</Trans>
                    </Text>
                  </View>
                )}

                {/* Examples */}
                <View className="gap-3">
                  <Text className="font-medium text-foreground text-sm">
                    <Trans>Examples</Trans>
                  </Text>
                  {exampleFields.map((field, index) => (
                    <View
                      className="rounded-lg border border-border bg-muted/20 p-3"
                      key={field.id}
                    >
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-muted-foreground text-sm">
                          <Trans>Example {index + 1}</Trans>
                        </Text>
                        <Pressable
                          className="p-1"
                          onPress={() => removeExample(index)}
                        >
                          <X color={colors.destructive} size={16} />
                        </Pressable>
                      </View>
                      <View className="gap-3">
                        <Controller
                          control={control}
                          name={`examples.${index}.sentence`}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                              onBlur={onBlur}
                              onChangeText={onChange}
                              placeholder={t`Arabic sentence`}
                              style={{ textAlign: "right" }}
                              value={value}
                            />
                          )}
                        />
                        <Controller
                          control={control}
                          name={`examples.${index}.translation`}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                              onBlur={onBlur}
                              onChangeText={onChange}
                              placeholder={t`English translation`}
                              value={value ?? ""}
                            />
                          )}
                        />
                      </View>
                    </View>
                  ))}
                  <Button
                    onPress={() =>
                      appendExample({ sentence: "", translation: "" })
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Plus color={colors.foreground} size={14} />
                    <Text className="ml-1 text-foreground">
                      <Trans>Add Example</Trans>
                    </Text>
                  </Button>
                </View>

                {/* Antonyms */}
                {showAntonyms && (
                  <View className="gap-3">
                    <Text className="font-medium text-foreground text-sm">
                      <Trans>Antonyms</Trans>
                    </Text>
                    {antonymFields.map((field, index) => (
                      <View
                        className="flex-row items-center gap-2"
                        key={field.id}
                      >
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name={`antonyms.${index}.word`}
                            render={({
                              field: { onChange, onBlur, value },
                            }) => (
                              <Input
                                onBlur={onBlur}
                                onChangeText={onChange}
                                placeholder={t`Antonym word`}
                                style={{ textAlign: "right" }}
                                value={value ?? ""}
                              />
                            )}
                          />
                        </View>
                        <Pressable
                          className="p-2"
                          onPress={() => removeAntonym(index)}
                        >
                          <X color={colors.destructive} size={16} />
                        </Pressable>
                      </View>
                    ))}
                    <Button
                      onPress={() => appendAntonym({ word: "" })}
                      size="sm"
                      variant="outline"
                    >
                      <Plus color={colors.foreground} size={14} />
                      <Text className="ml-1 text-foreground">
                        <Trans>Add Antonym</Trans>
                      </Text>
                    </Button>
                  </View>
                )}
              </View>
            </CardContent>
          </Card>

          {/* Morphology for Ism */}
          {showMorphology && wordType === "ism" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Trans>Noun Morphology</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="gap-5">
                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Singular</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.ism.singular"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            style={{ textAlign: "right" }}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Dual</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.ism.dual"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            style={{ textAlign: "right" }}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                  </View>

                  {/* Plurals */}
                  <View className="gap-3">
                    <Text className="font-medium text-foreground text-sm">
                      <Trans>Plurals</Trans>
                    </Text>
                    {pluralFields.map((field, index) => (
                      <View
                        className="flex-row items-center gap-2"
                        key={field.id}
                      >
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name={`morphology.ism.plurals.${index}.word`}
                            render={({
                              field: { onChange, onBlur, value },
                            }) => (
                              <Input
                                onBlur={onBlur}
                                onChangeText={onChange}
                                placeholder={t`Plural form`}
                                style={{ textAlign: "right" }}
                                value={value}
                              />
                            )}
                          />
                        </View>
                        <Pressable
                          className="p-2"
                          onPress={() => removePlural(index)}
                        >
                          <X color={colors.destructive} size={16} />
                        </Pressable>
                      </View>
                    ))}
                    <Button
                      onPress={() => appendPlural({ word: "" })}
                      size="sm"
                      variant="outline"
                    >
                      <Plus color={colors.foreground} size={14} />
                      <Text className="ml-1 text-foreground">
                        <Trans>Add Plural</Trans>
                      </Text>
                    </Button>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Gender</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.ism.gender"
                        render={({ field: { onChange, value } }) => (
                          <SelectDropdown
                            onChange={onChange}
                            options={GENDERS}
                            value={value}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Inflection</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.ism.inflection"
                        render={({ field: { onChange, value } }) => (
                          <SelectDropdown
                            onChange={onChange}
                            options={INFLECTIONS}
                            value={value}
                          />
                        )}
                      />
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          {/* Morphology for Verb */}
          {showMorphology && wordType === "fi'l" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Trans>Verb Morphology</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className="gap-5">
                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Past Tense</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.past_tense"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            style={{ textAlign: "right" }}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Present Tense</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.present_tense"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            style={{ textAlign: "right" }}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Imperative</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.imperative"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            style={{ textAlign: "right" }}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Form</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.form"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            placeholder="I, II, III..."
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Active Participle</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.active_participle"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            style={{ textAlign: "right" }}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="font-medium text-foreground text-sm">
                        <Trans>Passive Participle</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.passive_participle"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            style={{ textAlign: "right" }}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                  </View>

                  {/* Masadir */}
                  <View className="gap-3">
                    <Text className="font-medium text-foreground text-sm">
                      <Trans>Verbal Nouns (Masadir)</Trans>
                    </Text>
                    {masadirFields.map((field, index) => (
                      <View
                        className="flex-row items-center gap-2"
                        key={field.id}
                      >
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name={`morphology.verb.masadir.${index}.word`}
                            render={({
                              field: { onChange, onBlur, value },
                            }) => (
                              <Input
                                onBlur={onBlur}
                                onChangeText={onChange}
                                placeholder={t`Masdar`}
                                style={{ textAlign: "right" }}
                                value={value}
                              />
                            )}
                          />
                        </View>
                        <Pressable
                          className="p-2"
                          onPress={() => removeMasdar(index)}
                        >
                          <X color={colors.destructive} size={16} />
                        </Pressable>
                      </View>
                    ))}
                    <Button
                      onPress={() => appendMasdar({ word: "" })}
                      size="sm"
                      variant="outline"
                    >
                      <Plus color={colors.foreground} size={14} />
                      <Text className="ml-1 text-foreground">
                        <Trans>Add Masdar</Trans>
                      </Text>
                    </Button>
                  </View>

                  {/* Huroof */}
                  <View className="gap-3">
                    <Text className="font-medium text-foreground text-sm">
                      <Trans>Prepositions (Huroof)</Trans>
                    </Text>
                    {huroofFields.map((field, index) => (
                      <View
                        className="rounded-lg border border-border bg-muted/20 p-3"
                        key={field.id}
                      >
                        <View className="mb-2 flex-row items-center justify-between">
                          <Text className="text-muted-foreground text-sm">
                            <Trans>Harf {index + 1}</Trans>
                          </Text>
                          <Pressable
                            className="p-1"
                            onPress={() => removeHarf(index)}
                          >
                            <X color={colors.destructive} size={16} />
                          </Pressable>
                        </View>
                        <View className="gap-3">
                          <Controller
                            control={control}
                            name={`morphology.verb.huroof.${index}.harf`}
                            render={({
                              field: { onChange, onBlur, value },
                            }) => (
                              <Input
                                onBlur={onBlur}
                                onChangeText={onChange}
                                placeholder={t`Preposition`}
                                style={{ textAlign: "right" }}
                                value={value}
                              />
                            )}
                          />
                          <Controller
                            control={control}
                            name={`morphology.verb.huroof.${index}.meaning`}
                            render={({
                              field: { onChange, onBlur, value },
                            }) => (
                              <Input
                                onBlur={onBlur}
                                onChangeText={onChange}
                                placeholder={t`Meaning with this preposition`}
                                value={value ?? ""}
                              />
                            )}
                          />
                        </View>
                      </View>
                    ))}
                    <Button
                      onPress={() => appendHarf({ harf: "", meaning: "" })}
                      size="sm"
                      variant="outline"
                    >
                      <Plus color={colors.foreground} size={14} />
                      <Text className="ml-1 text-foreground">
                        <Trans>Add Harf</Trans>
                      </Text>
                    </Button>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Tags</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                control={control}
                name="tags"
                render={({ field: { onChange, value } }) => (
                  <TagsInput onChange={onChange} value={value} />
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
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
    </ScrollView>
  );
}
