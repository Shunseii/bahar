import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Plus, X } from "lucide-react-native";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormSchema } from "@/lib/schemas/dictionary";
import { useThemeColors } from "@/lib/theme";
import { CollapsibleCard } from "./CollapsibleCard";
import { useGenderOptions, useInflectionOptions } from "./constants";
import { FormSelect } from "./FormSelect";

type FormData = z.infer<typeof FormSchema>;

export const IsmMorphologySection = () => {
  const colors = useThemeColors();
  const { control } = useFormContext<FormData>();
  const genderOptions = useGenderOptions();
  const inflectionOptions = useInflectionOptions();

  const {
    fields: pluralFields,
    append: appendPlural,
    remove: removePlural,
  } = useFieldArray({ control, name: "morphology.ism.plurals" });

  return (
    <CollapsibleCard title={t`Noun Morphology`}>
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

        <View className="gap-3">
          <Text className="font-medium text-foreground text-sm">
            <Trans>Plurals</Trans>
          </Text>
          {pluralFields.map((field, index) => (
            <View
              className="rounded-lg border border-border bg-muted/20 p-3"
              key={field.id}
            >
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-muted-foreground text-sm">
                  <Trans>Plural {index + 1}</Trans>
                </Text>
                <Pressable className="p-1" onPress={() => removePlural(index)}>
                  <X color={colors.mutedForeground} size={16} />
                </Pressable>
              </View>
              <View className="gap-3">
                <Controller
                  control={control}
                  name={`morphology.ism.plurals.${index}.word`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t`Plural form`}
                      style={{ textAlign: "right" }}
                      value={value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`morphology.ism.plurals.${index}.details`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t`Details (e.g. frequency, usage context)`}
                      value={value ?? ""}
                    />
                  )}
                />
              </View>
            </View>
          ))}
          <Button
            Icon={Plus}
            onPress={() => appendPlural({ word: "", details: "" })}
            size="sm"
            variant="outline"
          >
            <Trans>Add Plural</Trans>
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
                <FormSelect
                  onChange={onChange}
                  options={genderOptions}
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
                <FormSelect
                  onChange={onChange}
                  options={inflectionOptions}
                  value={value}
                />
              )}
            />
          </View>
        </View>
      </View>
    </CollapsibleCard>
  );
};
