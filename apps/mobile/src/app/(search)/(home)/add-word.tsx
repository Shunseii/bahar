import React from "react";
import { Text, View, Pressable } from "react-native";
import { Page } from "@/components/Page";
import { Trans } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { useLocales } from "expo-localization";
import { useColorScheme } from "react-native";
import { cn } from "@bahar/design-system";
import { cssVariables } from "@bahar/design-system/theme";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormSchema } from "@bahar/schemas";
import type { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { toast } from "sonner-native";
import { t } from "@lingui/core/macro";

const Breadcrumbs = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const themeColors =
    colorScheme === "dark" ? cssVariables.dark : cssVariables.light;

  return (
    <View className={cn("mb-8")}>
      <View className="flex flex-row items-center gap-2.5">
        <View className="items-center gap-1.5">
          <Pressable onPress={() => router.push("/")}>
            <Text className="text-sm text-muted-foreground">
              <Trans>Home</Trans>
            </Text>
          </Pressable>
        </View>

        <View className="items-center">
          <ChevronRight
            size={14}
            color={`hsl(${themeColors["--muted-foreground"]})`}
          />
        </View>

        <View className="inline-flex items-center gap-1.5">
          <Text className="text-sm font-normal text-foreground">
            <Trans>Add word</Trans>
          </Text>
        </View>
      </View>
    </View>
  );
};

const BackButton = () => {
  const router = useRouter();
  const locales = useLocales();
  const colorScheme = useColorScheme();
  const dir = locales[0].textDirection;

  return (
    <Button variant="outline" size="icon" onPress={() => router.push("/")}>
      {dir === "rtl" ? (
        <ChevronRight
          size={16}
          color={colorScheme === "dark" ? "white" : "black"}
        />
      ) : (
        <ChevronLeft
          size={16}
          color={colorScheme === "dark" ? "white" : "black"}
        />
      )}
    </Button>
  );
};

type FormData = z.infer<typeof FormSchema>;

export default function AddWordScreen() {
  const addWordMutation = useMutation(
    trpc.dictionary.addWord.mutationOptions(),
  );
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
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

  const onSubmit = async (data: FormData) => {
    try {
      const { word, translation } = data;

      await addWordMutation.mutateAsync({ word, translation });

      reset();
    } catch (error) {
      console.error("Error saving word:", error);
    }
  };

  return (
    <Page className="pt-0 px-4">
      <View className="flex-1 pt-4">
        <Breadcrumbs />

        <View className="max-w-full flex-1 gap-y-4">
          <View className="flex-row items-center gap-4">
            <BackButton />

            <Text className="flex-1 text-xl font-semibold text-foreground tracking-tight">
              <Trans>Add a new word to your dictionary</Trans>
            </Text>
          </View>

          <View className="grid gap-4 lg:gap-8">
            <Card>
              <CardHeader>
                <CardTitle>
                  <Trans>Basic Details</Trans>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <View className="gap-6">
                  <View className="gap-2">
                    <Text className="text-sm font-medium leading-none text-foreground">
                      <Trans>Word</Trans> *
                    </Text>
                    <Controller
                      control={control}
                      name="word"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          className="w-full"
                          style={{ textAlign: "right" }}
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                        />
                      )}
                    />
                    {errors.word && (
                      <Text className="text-sm text-red-500">
                        {errors.word.message}
                      </Text>
                    )}
                  </View>

                  <View className="gap-2">
                    <Text className="text-sm font-medium leading-none text-foreground">
                      <Trans>Translation</Trans> *
                    </Text>
                    <Controller
                      control={control}
                      name="translation"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          className="w-full"
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                        />
                      )}
                    />
                    {errors.translation && (
                      <Text className="text-sm text-red-500">
                        {errors.translation.message}
                      </Text>
                    )}
                    <Text className="text-sm text-muted-foreground">
                      <Trans>An English translation of the word.</Trans>
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>

          <View className="flex flex-row self-center items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.push("/")}
            >
              <Trans>Discard</Trans>
            </Button>

            <Button
              variant="default"
              size="sm"
              onPress={() => handleSubmit(onSubmit)()}
              disabled={isSubmitting}
            >
              <Trans>Save</Trans>
            </Button>
          </View>
        </View>
      </View>
    </Page>
  );
}
