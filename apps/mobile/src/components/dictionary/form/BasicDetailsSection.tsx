import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Controller, useFormContext } from "react-hook-form";
import { Text, View } from "react-native";
import type { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FormSchema } from "@/lib/schemas/dictionary";
import { useWordTypeOptions } from "./constants";
import { FormSelect } from "./FormSelect";

type FormData = z.infer<typeof FormSchema>;

export const BasicDetailsSection = () => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<FormData>();

  const wordType = watch("type");
  const showRootField = wordType === "ism" || wordType === "fi'l";
  const wordTypeOptions = useWordTypeOptions();

  return (
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
            <Text className="text-muted-foreground text-xs">
              <Trans>How you'd translate this word in English</Trans>
            </Text>
            {errors.translation && (
              <Text className="text-destructive text-sm">
                {errors.translation.message}
              </Text>
            )}
          </View>

          <View className="gap-2">
            <Text className="font-medium text-foreground text-sm">
              <Trans>Type</Trans>
            </Text>
            <Controller
              control={control}
              name="type"
              render={({ field: { onChange, value } }) => (
                <FormSelect
                  onChange={onChange}
                  options={wordTypeOptions}
                  placeholder={t`Select type`}
                  value={value}
                />
              )}
            />
          </View>

          <View className="h-px bg-border" />

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
            <Text className="text-muted-foreground text-xs">
              <Trans>An Arabic-language definition of the word</Trans>
            </Text>
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
        </View>
      </CardContent>
    </Card>
  );
};
