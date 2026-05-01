import type { Morphology, WordType } from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import type React from "react";
import { Text, View } from "react-native";

interface PropertiesRowProps {
  type: WordType;
  morphology: Morphology | null | undefined;
}

const TYPE_LABELS: Record<WordType, () => string> = {
  ism: () => t`Ism`,
  "fi'l": () => t`Fi'l`,
  harf: () => t`Harf`,
  expression: () => t`Expression`,
};

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View className="rounded-full bg-muted px-2.5 py-0.5">
    <Text className="font-medium text-[12px] text-foreground">{children}</Text>
  </View>
);

export const PropertiesRow: React.FC<PropertiesRowProps> = ({
  type,
  morphology,
}) => {
  const verb = morphology?.verb;
  const pills: string[] = [TYPE_LABELS[type]()];

  if (verb?.form) pills.push(t`Form ${verb.form}`);

  return (
    <View className="flex-row flex-wrap items-center justify-center gap-1.5">
      {pills.map((label) => (
        <Pill key={label}>{label}</Pill>
      ))}
      {verb?.form_arabic && (
        <View className="rounded-full bg-muted px-2.5 py-0.5">
          <Text
            className="font-medium text-[13px] text-foreground"
            style={{ writingDirection: "rtl" }}
          >
            {verb.form_arabic}
          </Text>
        </View>
      )}
    </View>
  );
};

export default PropertiesRow;
