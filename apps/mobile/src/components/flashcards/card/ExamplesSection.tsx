import type { Example } from "@bahar/drizzle-user-db-schemas";
import { plural } from "@lingui/core/macro";
import type React from "react";
import { Text, View } from "react-native";
import { SectionHeader } from "./shared";

interface ExamplesSectionProps {
  examples: Example[];
}

export const ExamplesSection: React.FC<ExamplesSectionProps> = ({
  examples,
}) => {
  if (!examples || examples.length === 0) return null;

  // A plural rather than a two-way ternary: Arabic has dual and several plural
  // categories, so one/other alone can't be translated correctly.
  const headerLabel = plural(examples.length, {
    one: "EXAMPLE",
    other: "EXAMPLES",
  });

  return (
    <View className="w-full gap-3">
      <SectionHeader label={headerLabel} />
      {examples.map((ex, idx) => (
        <View className="gap-1" key={`${ex.sentence}-${idx}`}>
          {ex.context && (
            <View style={{ direction: "ltr" }}>
              <Text
                className="font-semibold text-[10px] text-muted-foreground/70 uppercase"
                style={{ letterSpacing: 0.6 }}
              >
                {ex.context}
              </Text>
            </View>
          )}
          <View style={{ direction: "rtl" }}>
            <Text className="text-[17px] text-foreground">{ex.sentence}</Text>
          </View>
          {ex.translation && (
            <View style={{ direction: "ltr" }}>
              <Text className="text-[13px] text-muted-foreground italic">
                {ex.translation}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

export default ExamplesSection;
