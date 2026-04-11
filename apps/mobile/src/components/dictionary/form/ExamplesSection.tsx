import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Plus, Sparkles, X } from "lucide-react-native";
import { useState } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { toast } from "sonner-native";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserPlan } from "@/hooks/useUserPlan";
import type { FormSchema } from "@/lib/schemas/dictionary";
import { useThemeColors } from "@/lib/theme";
import { api } from "@/utils/api";
import { CollapsibleCard } from "./CollapsibleCard";

type FormData = z.infer<typeof FormSchema>;

export const ExamplesSection = () => {
  const colors = useThemeColors();
  const { isProUser, isFreeUser } = useUserPlan();
  const [isGenerating, setIsGenerating] = useState(false);
  const { control, getValues, watch } = useFormContext<FormData>();

  const word = watch("word");
  const translation = watch("translation");
  const hasRequiredFields = !!word?.trim() && !!translation?.trim();
  const isGenerateDisabled = isGenerating || !isProUser || !hasRequiredFields;

  const {
    fields: exampleFields,
    append: appendExample,
    remove: removeExample,
  } = useFieldArray({ control, name: "examples" });

  const handleGenerate = async () => {
    const word = getValues("word");
    const translation = getValues("translation");

    if (!word || !translation) {
      toast.error(t`Enter a word and translation first`);
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await api.ai.examples.post({
        word,
        translation,
      });

      if (error) {
        const status = (error as { status?: number }).status;
        if (status === 429) {
          toast.error(t`Rate limit reached. Please wait a moment.`);
        } else {
          toast.error(t`Failed to generate example`);
        }
        return;
      }

      if (data) {
        appendExample({
          sentence: data.sentence,
          translation: data.translation ?? "",
        });
        toast.success(t`Example generated`);
      }
    } catch {
      toast.error(t`Failed to generate example`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <CollapsibleCard title={t`Examples`}>
      <View className="gap-3">
        {exampleFields.map((field, index) => (
          <View
            className="rounded-lg border border-border bg-muted/20 p-3"
            key={field.id}
          >
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-muted-foreground text-sm">
                <Trans>Example {index + 1}</Trans>
              </Text>
              <Pressable className="p-1" onPress={() => removeExample(index)}>
                <X color={colors.mutedForeground} size={16} />
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
              <Controller
                control={control}
                name={`examples.${index}.context`}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder={t`Context (e.g. formal, colloquial)`}
                    value={value ?? ""}
                  />
                )}
              />
            </View>
          </View>
        ))}
        <View className="flex-row gap-2">
          <Button
            Icon={Plus}
            onPress={() =>
              appendExample({
                sentence: "",
                translation: "",
                context: "",
              })
            }
            size="sm"
            variant="outline"
          >
            <Trans>Add Example</Trans>
          </Button>
          <Pressable
            disabled={isGenerateDisabled}
            onPress={handleGenerate}
            style={{ opacity: isGenerateDisabled ? 0.5 : 1 }}
          >
            <View className="h-9 flex-row items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3">
              {isGenerating ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Sparkles color={colors.primary} size={14} />
              )}
              <Text className="text-primary text-sm">
                <Trans>Generate</Trans>
              </Text>
              {isFreeUser && (
                <View className="rounded bg-primary/10 px-1 py-0.5">
                  <Text className="font-bold text-[9px] text-primary tracking-wider">
                    PRO
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </CollapsibleCard>
  );
};
