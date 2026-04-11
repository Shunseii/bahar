import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Plus, X } from "lucide-react-native";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Pressable, View } from "react-native";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormSchema } from "@/lib/schemas/dictionary";
import { useThemeColors } from "@/lib/theme";
import { CollapsibleCard } from "./CollapsibleCard";

type FormData = z.infer<typeof FormSchema>;

export const AntonymsSection = () => {
  const colors = useThemeColors();
  const { control } = useFormContext<FormData>();

  const {
    fields: antonymFields,
    append: appendAntonym,
    remove: removeAntonym,
  } = useFieldArray({ control, name: "antonyms" });

  return (
    <CollapsibleCard title={t`Antonyms`}>
      <View className="gap-3">
        {antonymFields.map((field, index) => (
          <View className="flex-row items-center gap-2" key={field.id}>
            <View className="flex-1">
              <Controller
                control={control}
                name={`antonyms.${index}.word`}
                render={({ field: { onChange, onBlur, value } }) => (
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
            <Pressable className="p-2" onPress={() => removeAntonym(index)}>
              <X color={colors.mutedForeground} size={16} />
            </Pressable>
          </View>
        ))}
        <Button
          Icon={Plus}
          onPress={() => appendAntonym({ word: "" })}
          size="sm"
          variant="outline"
        >
          <Trans>Add Antonym</Trans>
        </Button>
      </View>
    </CollapsibleCard>
  );
};
