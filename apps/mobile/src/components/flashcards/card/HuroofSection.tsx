import type { Morphology } from "@bahar/drizzle-user-db-schemas";
import type React from "react";
import { Text, View } from "react-native";
import { SectionHeader } from "./shared";

interface HuroofSectionProps {
  verb: NonNullable<Morphology>["verb"];
  baseWord: string;
}

export const HuroofSection: React.FC<HuroofSectionProps> = ({
  verb,
  baseWord,
}) => {
  if (!verb?.huroof || verb.huroof.length === 0) return null;

  return (
    <View className="w-full gap-2">
      <SectionHeader label="PARTICLE PAIRINGS" />
      {verb.huroof.map((h, idx) => (
        <View
          className="flex-row items-center justify-between"
          key={`${h.harf}-${idx}`}
        >
          <View className="flex-row items-center gap-1.5">
            <Text
              className="font-medium text-[16px] text-foreground"
              style={{ writingDirection: "rtl" }}
            >
              {baseWord}
            </Text>
            <Text className="text-[13px] text-muted-foreground/60">+</Text>
            <Text
              className="font-medium text-[16px] text-foreground"
              style={{ writingDirection: "rtl" }}
            >
              {h.harf}
            </Text>
          </View>
          {h.meaning && (
            <Text className="text-[13px] text-muted-foreground italic">
              {h.meaning}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
};

export default HuroofSection;
