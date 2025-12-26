import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Trash2,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { useLocales } from "expo-localization";
import { useThemeColors } from "@/lib/theme";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormSchema } from "@/lib/schemas/dictionary";
import { errorMap } from "@/utils/zod";
import * as z from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { t } from "@lingui/core/macro";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { updateSearchIndex, removeFromSearchIndex } from "@/lib/search";
import { queryClient } from "@/utils/trpc";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
          <Text className="text-sm text-muted-foreground">
            <Trans>Home</Trans>
          </Text>
        </Pressable>
        <ChevronRight
          size={14}
          color={colors.mutedForeground}
        />
        <Text className="text-sm font-normal text-foreground">
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
    <Button variant="outline" size="icon" onPress={() => router.back()}>
      {dir === "rtl" ? (
        <ChevronRight
          size={16}
          color={colors.foreground}
        />
      ) : (
        <ChevronLeft
          size={16}
          color={colors.foreground}
        />
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
              key={index}
              className="flex-row items-center px-3 py-1.5 rounded-full bg-primary/10"
            >
              <Text className="text-sm text-primary">{tag.name}</Text>
              <Pressable
                onPress={() => {
                  const newTags = value.filter((_, i) => i !== index);
                  onChange(newTags);
                }}
                className="ml-1.5"
              >
                <X size={14} color={colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Input
        placeholder={t`Add a tag and press enter`}
        value={tagInput}
        onChangeText={setTagInput}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
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
        onPress={() => setIsOpen(!isOpen)}
        className="flex-row items-center justify-between px-3 py-2.5 rounded-md border border-input bg-background"
      >
        <Text className={value ? "text-foreground" : "text-muted-foreground"}>
          {value
            ? options.find((o) => o.value === value)?.label
            : placeholder}
        </Text>
        <ChevronDown
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>
      {isOpen && (
        <View className="mt-1 rounded-md border border-input bg-background overflow-hidden">
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`px-3 py-2.5 ${
                value === option.value ? "bg-primary/10" : ""
              } active:bg-muted`}
            >
              <Text
                className={
                  value === option.value
                    ? "text-primary font-medium"
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
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !entry) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-destructive text-lg font-medium mb-2">
          <Trans>Word not found</Trans>
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
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
            <Text className="flex-1 text-xl font-semibold text-foreground tracking-tight">
              <Trans>Edit word</Trans>
            </Text>
            <Button
              variant="ghost"
              size="icon"
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2
                size={20}
                color={colors.destructive}
              />
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
                  <Text className="text-sm font-medium text-foreground">
                    <Trans>Word</Trans> *
                  </Text>
                  <Controller
                    control={control}
                    name="word"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        style={{ textAlign: "right" }}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        placeholder={t`Arabic word`}
                      />
                    )}
                  />
                  {errors.word && (
                    <Text className="text-sm text-destructive">
                      {errors.word.message}
                    </Text>
                  )}
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    <Trans>Translation</Trans> *
                  </Text>
                  <Controller
                    control={control}
                    name="translation"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        placeholder={t`English translation`}
                      />
                    )}
                  />
                  {errors.translation && (
                    <Text className="text-sm text-destructive">
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
                <Text className="text-sm font-medium text-foreground">
                  <Trans>Type</Trans>
                </Text>
                <Controller
                  control={control}
                  name="type"
                  render={({ field: { onChange, value } }) => (
                    <SelectDropdown
                      value={value}
                      options={WORD_TYPES}
                      onChange={onChange}
                      placeholder={t`Select type`}
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
                  <Text className="text-sm font-medium text-foreground">
                    <Trans>Definition</Trans>
                  </Text>
                  <Controller
                    control={control}
                    name="definition"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        style={{ textAlign: "right" }}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value ?? ""}
                        placeholder={t`Arabic definition`}
                        multiline
                        numberOfLines={3}
                      />
                    )}
                  />
                </View>

                {showRootField && (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">
                      <Trans>Root Letters</Trans>
                    </Text>
                    <Controller
                      control={control}
                      name="root"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          style={{ textAlign: "right" }}
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value ?? ""}
                          placeholder={t`e.g. ك ت ب`}
                        />
                      )}
                    />
                    <Text className="text-xs text-muted-foreground">
                      <Trans>Separate letters with spaces or commas</Trans>
                    </Text>
                  </View>
                )}

                {/* Examples */}
                <View className="gap-3">
                  <Text className="text-sm font-medium text-foreground">
                    <Trans>Examples</Trans>
                  </Text>
                  {exampleFields.map((field, index) => (
                    <View
                      key={field.id}
                      className="p-3 rounded-lg border border-border bg-muted/20"
                    >
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-sm text-muted-foreground">
                          <Trans>Example {index + 1}</Trans>
                        </Text>
                        <Pressable
                          onPress={() => removeExample(index)}
                          className="p-1"
                        >
                          <X
                            size={16}
                            color={
                              colors.destructive
                            }
                          />
                        </Pressable>
                      </View>
                      <View className="gap-3">
                        <Controller
                          control={control}
                          name={`examples.${index}.sentence`}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                              style={{ textAlign: "right" }}
                              onBlur={onBlur}
                              onChangeText={onChange}
                              value={value}
                              placeholder={t`Arabic sentence`}
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
                              value={value ?? ""}
                              placeholder={t`English translation`}
                            />
                          )}
                        />
                      </View>
                    </View>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      appendExample({ sentence: "", translation: "" })
                    }
                  >
                    <Plus
                      size={14}
                      color={colors.foreground}
                    />
                    <Text className="text-foreground ml-1">
                      <Trans>Add Example</Trans>
                    </Text>
                  </Button>
                </View>

                {/* Antonyms */}
                {showAntonyms && (
                  <View className="gap-3">
                    <Text className="text-sm font-medium text-foreground">
                      <Trans>Antonyms</Trans>
                    </Text>
                    {antonymFields.map((field, index) => (
                      <View
                        key={field.id}
                        className="flex-row items-center gap-2"
                      >
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name={`antonyms.${index}.word`}
                            render={({
                              field: { onChange, onBlur, value },
                            }) => (
                              <Input
                                style={{ textAlign: "right" }}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value ?? ""}
                                placeholder={t`Antonym word`}
                              />
                            )}
                          />
                        </View>
                        <Pressable
                          onPress={() => removeAntonym(index)}
                          className="p-2"
                        >
                          <X
                            size={16}
                            color={
                              colors.destructive
                            }
                          />
                        </Pressable>
                      </View>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => appendAntonym({ word: "" })}
                    >
                      <Plus
                        size={14}
                        color={colors.foreground}
                      />
                      <Text className="text-foreground ml-1">
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
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Singular</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.ism.singular"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            style={{ textAlign: "right" }}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Dual</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.ism.dual"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            style={{ textAlign: "right" }}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                  </View>

                  {/* Plurals */}
                  <View className="gap-3">
                    <Text className="text-sm font-medium text-foreground">
                      <Trans>Plurals</Trans>
                    </Text>
                    {pluralFields.map((field, index) => (
                      <View
                        key={field.id}
                        className="flex-row items-center gap-2"
                      >
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name={`morphology.ism.plurals.${index}.word`}
                            render={({
                              field: { onChange, onBlur, value },
                            }) => (
                              <Input
                                style={{ textAlign: "right" }}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                placeholder={t`Plural form`}
                              />
                            )}
                          />
                        </View>
                        <Pressable
                          onPress={() => removePlural(index)}
                          className="p-2"
                        >
                          <X
                            size={16}
                            color={
                              colors.destructive
                            }
                          />
                        </Pressable>
                      </View>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => appendPlural({ word: "" })}
                    >
                      <Plus
                        size={14}
                        color={colors.foreground}
                      />
                      <Text className="text-foreground ml-1">
                        <Trans>Add Plural</Trans>
                      </Text>
                    </Button>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Gender</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.ism.gender"
                        render={({ field: { onChange, value } }) => (
                          <SelectDropdown
                            value={value}
                            options={GENDERS}
                            onChange={onChange}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Inflection</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.ism.inflection"
                        render={({ field: { onChange, value } }) => (
                          <SelectDropdown
                            value={value}
                            options={INFLECTIONS}
                            onChange={onChange}
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
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Past Tense</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.past_tense"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            style={{ textAlign: "right" }}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Present Tense</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.present_tense"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            style={{ textAlign: "right" }}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Imperative</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.imperative"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            style={{ textAlign: "right" }}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Form</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.form"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value ?? ""}
                            placeholder="I, II, III..."
                          />
                        )}
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Active Participle</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.active_participle"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            style={{ textAlign: "right" }}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="text-sm font-medium text-foreground">
                        <Trans>Passive Participle</Trans>
                      </Text>
                      <Controller
                        control={control}
                        name="morphology.verb.passive_participle"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input
                            style={{ textAlign: "right" }}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value ?? ""}
                          />
                        )}
                      />
                    </View>
                  </View>

                  {/* Masadir */}
                  <View className="gap-3">
                    <Text className="text-sm font-medium text-foreground">
                      <Trans>Verbal Nouns (Masadir)</Trans>
                    </Text>
                    {masadirFields.map((field, index) => (
                      <View
                        key={field.id}
                        className="flex-row items-center gap-2"
                      >
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name={`morphology.verb.masadir.${index}.word`}
                            render={({
                              field: { onChange, onBlur, value },
                            }) => (
                              <Input
                                style={{ textAlign: "right" }}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                placeholder={t`Masdar`}
                              />
                            )}
                          />
                        </View>
                        <Pressable
                          onPress={() => removeMasdar(index)}
                          className="p-2"
                        >
                          <X
                            size={16}
                            color={
                              colors.destructive
                            }
                          />
                        </Pressable>
                      </View>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => appendMasdar({ word: "" })}
                    >
                      <Plus
                        size={14}
                        color={colors.foreground}
                      />
                      <Text className="text-foreground ml-1">
                        <Trans>Add Masdar</Trans>
                      </Text>
                    </Button>
                  </View>

                  {/* Huroof */}
                  <View className="gap-3">
                    <Text className="text-sm font-medium text-foreground">
                      <Trans>Prepositions (Huroof)</Trans>
                    </Text>
                    {huroofFields.map((field, index) => (
                      <View
                        key={field.id}
                        className="p-3 rounded-lg border border-border bg-muted/20"
                      >
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-sm text-muted-foreground">
                            <Trans>Harf {index + 1}</Trans>
                          </Text>
                          <Pressable
                            onPress={() => removeHarf(index)}
                            className="p-1"
                          >
                            <X
                              size={16}
                              color={
                                colors.destructive
                              }
                            />
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
                                style={{ textAlign: "right" }}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                placeholder={t`Preposition`}
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
                                value={value ?? ""}
                                placeholder={t`Meaning with this preposition`}
                              />
                            )}
                          />
                        </View>
                      </View>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => appendHarf({ harf: "", meaning: "" })}
                    >
                      <Plus
                        size={14}
                        color={colors.foreground}
                      />
                      <Text className="text-foreground ml-1">
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
                  <TagsInput value={value} onChange={onChange} />
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <View className="flex-row justify-center items-center gap-3 pt-2">
            <Button variant="outline" onPress={() => router.back()}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              variant="default"
              onPress={() => handleSubmit(onSubmit)()}
              disabled={isSubmitting || editMutation.isPending || !isDirty}
            >
              {editMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
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
