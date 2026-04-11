import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Sparkles } from "lucide-react-native";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { toast } from "sonner-native";
import type { z } from "zod";
import { useUserPlan } from "@/hooks/useUserPlan";
import type { FormSchema } from "@/lib/schemas/dictionary";
import { useThemeColors } from "@/lib/theme";
import { api } from "@/utils/api";

type FormData = z.infer<typeof FormSchema>;

export const AutofillButton = () => {
  const colors = useThemeColors();
  const { isProUser } = useUserPlan();
  const [isLoading, setIsLoading] = useState(false);
  const { setValue, watch } = useFormContext<FormData>();

  const word = watch("word");
  const translation = watch("translation");
  const type = watch("type");
  const canAutofill = !!word?.trim() && !!translation?.trim() && !!type;
  const isDisabled = isLoading || !isProUser || !canAutofill;

  const handleAutofill = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await api.ai.autocomplete.post({
        word: word!,
        translation: translation!,
        type: type ?? "ism",
      });

      if (error) {
        const status = (error as { status?: number }).status;
        if (status === 429) {
          toast.error(t`Rate limit reached. Please wait a moment.`);
        } else {
          toast.error(t`Failed to autofill`);
        }
        return;
      }

      if (!data) return;

      if (data.definition) {
        setValue("definition", data.definition);
      }

      if (data.root && Array.isArray(data.root)) {
        setValue("root", data.root.join(" "));
      }

      if ("morphology" in data && data.morphology) {
        const m = data.morphology as Record<string, unknown>;

        if (type === "ism") {
          const ism = m as {
            singular?: string;
            dual?: string;
            plurals?: { word: string; details?: string }[];
            gender?: "masculine" | "feminine";
            inflection?: "indeclinable" | "diptote" | "triptote";
          };
          if (ism.singular) setValue("morphology.ism.singular", ism.singular);
          if (ism.dual) setValue("morphology.ism.dual", ism.dual);
          if (ism.plurals?.length)
            setValue("morphology.ism.plurals", ism.plurals);
          if (ism.gender) setValue("morphology.ism.gender", ism.gender);
          if (ism.inflection)
            setValue("morphology.ism.inflection", ism.inflection);
        }

        if (type === "fi'l") {
          const verb = m as {
            past_tense?: string;
            present_tense?: string;
            active_participle?: string;
            passive_participle?: string;
            imperative?: string;
            masadir?: { word: string; details?: string }[];
            form?: string;
            form_arabic?: string;
            huroof?: { harf: string; meaning?: string }[];
          };
          if (verb.past_tense)
            setValue("morphology.verb.past_tense", verb.past_tense);
          if (verb.present_tense)
            setValue("morphology.verb.present_tense", verb.present_tense);
          if (verb.active_participle)
            setValue(
              "morphology.verb.active_participle",
              verb.active_participle
            );
          if (verb.passive_participle)
            setValue(
              "morphology.verb.passive_participle",
              verb.passive_participle
            );
          if (verb.imperative)
            setValue("morphology.verb.imperative", verb.imperative);
          if (verb.masadir?.length)
            setValue("morphology.verb.masadir", verb.masadir);
          if (verb.form) setValue("morphology.verb.form", verb.form);
          if (verb.form_arabic)
            setValue("morphology.verb.form_arabic", verb.form_arabic);
          if (verb.huroof?.length)
            setValue("morphology.verb.huroof", verb.huroof);
        }
      }

      toast.success(t`Fields filled successfully`);
    } catch {
      toast.error(t`Failed to autofill`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      className="self-start"
      disabled={isDisabled}
      onPress={handleAutofill}
      style={{ opacity: isDisabled ? 0.6 : 1 }}
    >
      <View className="h-9 flex-row items-center gap-2 rounded-md bg-primary px-3">
        {isLoading ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <Sparkles color={colors.primaryForeground} size={16} />
        )}
        <Text className="font-medium text-primary-foreground text-sm">
          {isLoading ? <Trans>Generating...</Trans> : <Trans>Autofill</Trans>}
        </Text>
        {!isProUser && (
          <View className="rounded bg-white/20 px-1.5 py-0.5">
            <Text className="font-bold text-[10px] text-white uppercase">
              Pro
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};
