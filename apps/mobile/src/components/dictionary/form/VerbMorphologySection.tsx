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

type FormData = z.infer<typeof FormSchema>;

export const VerbMorphologySection = () => {
  const colors = useThemeColors();
  const { control } = useFormContext<FormData>();

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

  return (
    <CollapsibleCard title={t`Verb Morphology`}>
      <View className="gap-5">
        {/* Past Tense / Present Tense */}
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

        {/* Imperative (full width) */}
        <View className="gap-2">
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

        {/* Active Participle / Passive Participle */}
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

        {/* Form / Arabic Form */}
        <View className="flex-row gap-3">
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
            <Text className="text-muted-foreground text-xs">
              <Trans>Roman numeral form (I, II, III...)</Trans>
            </Text>
          </View>
          <View className="flex-1 gap-2">
            <Text className="font-medium text-foreground text-sm">
              <Trans>Arabic Form</Trans>
            </Text>
            <Controller
              control={control}
              name="morphology.verb.form_arabic"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t`e.g. فعل, أفعل`}
                  style={{ textAlign: "right" }}
                  value={value ?? ""}
                />
              )}
            />
            <Text className="text-muted-foreground text-xs">
              <Trans>The Arabic pattern of the verb form</Trans>
            </Text>
          </View>
        </View>

        {/* Masadir (Verbal Nouns) */}
        <View className="gap-3">
          <Text className="font-medium text-foreground text-sm">
            <Trans>Verbal Nouns (Masadir)</Trans>
          </Text>
          {masadirFields.map((field, index) => (
            <View
              className="rounded-lg border border-border bg-muted/20 p-3"
              key={field.id}
            >
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-muted-foreground text-sm">
                  <Trans>Masdar {index + 1}</Trans>
                </Text>
                <Pressable className="p-1" onPress={() => removeMasdar(index)}>
                  <X color={colors.mutedForeground} size={16} />
                </Pressable>
              </View>
              <View className="gap-3">
                <Controller
                  control={control}
                  name={`morphology.verb.masadir.${index}.word`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t`Masdar`}
                      style={{ textAlign: "right" }}
                      value={value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`morphology.verb.masadir.${index}.details`}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t`Details (e.g. usage context)`}
                      value={value ?? ""}
                    />
                  )}
                />
              </View>
            </View>
          ))}
          <Button
            Icon={Plus}
            onPress={() => appendMasdar({ word: "", details: "" })}
            size="sm"
            variant="outline"
          >
            <Trans>Add Masdar</Trans>
          </Button>
        </View>

        {/* Huroof (Prepositions) */}
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
                <Pressable className="p-1" onPress={() => removeHarf(index)}>
                  <X color={colors.mutedForeground} size={16} />
                </Pressable>
              </View>
              <View className="gap-3">
                <Controller
                  control={control}
                  name={`morphology.verb.huroof.${index}.harf`}
                  render={({ field: { onChange, onBlur, value } }) => (
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
                  render={({ field: { onChange, onBlur, value } }) => (
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
            Icon={Plus}
            onPress={() => appendHarf({ harf: "", meaning: "" })}
            size="sm"
            variant="outline"
          >
            <Trans>Add Harf</Trans>
          </Button>
        </View>
      </View>
    </CollapsibleCard>
  );
};
